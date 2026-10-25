const {
  getAssignmentsCollection,
  getUsersCollection,
} = require("../models");
const { getNotificationPreferences } = require("../utils/userUtils");
const { notifyUserOnce } = require("./socketService");

const REMINDER_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 100;
const SHORT_DEADLINE_MS = 60 * 60 * 1000;
const SHORT_DEADLINE_REMINDER_MS = 20 * 60 * 1000;
const STANDARD_REMINDER_MS = 60 * 60 * 1000;

function getAssignmentReminderDueAt(givenAt, deadline) {
  const givenAtDate = new Date(givenAt);
  const deadlineDate = new Date(deadline);
  const delay = deadlineDate.getTime() - givenAtDate.getTime() < SHORT_DEADLINE_MS
    ? SHORT_DEADLINE_REMINDER_MS
    : STANDARD_REMINDER_MS;
  return new Date(givenAtDate.getTime() + delay).toISOString();
}

async function reconcilePendingAssignmentReminders() {
  const assignments = await getAssignmentsCollection()
    .find(
      { reminderProcessedAt: { $exists: false } },
      {
        projection: {
          _id: 0,
          id: 1,
          givenAt: 1,
          createdAt: 1,
          deadline: 1,
          reminderDueAt: 1,
        },
      }
    )
    .toArray();

  for (const assignment of assignments) {
    const givenAt = assignment.givenAt || assignment.createdAt;
    if (!givenAt || !assignment.deadline) continue;
    const reminderDueAt = getAssignmentReminderDueAt(givenAt, assignment.deadline);
    if (assignment.reminderDueAt === reminderDueAt) continue;
    await getAssignmentsCollection().updateOne(
      { id: assignment.id, reminderProcessedAt: { $exists: false } },
      { $set: { reminderDueAt } }
    );
  }
}

async function dispatchDueAssignmentReminders(now = new Date()) {
  const nowIso = now.toISOString();
  const assignments = await getAssignmentsCollection()
    .find(
      {
        reminderDueAt: { $lte: nowIso },
        reminderProcessedAt: { $exists: false },
      },
      {
        projection: {
          _id: 0,
          id: 1,
          title: 1,
          subject: 1,
          givenAt: 1,
          createdAt: 1,
          deadline: 1,
          reminderDueAt: 1,
          classes: 1,
          studentIds: 1,
        },
      }
    )
    .sort({ reminderDueAt: 1 })
    .limit(BATCH_SIZE)
    .toArray();

  const assignmentsCollection = getAssignmentsCollection();
  const users = getUsersCollection();

  for (const assignment of assignments) {
    const classes = Array.isArray(assignment.classes) ? assignment.classes : [];
    const studentIds = Array.isArray(assignment.studentIds) ? assignment.studentIds : [];
    const recipients = [];
    if (classes.length || studentIds.length) {
      const clauses = [];
      if (classes.length) clauses.push({ class: { $in: classes } });
      if (studentIds.length) clauses.push({ id: { $in: studentIds } });
      recipients.push(...await users
        .find(
          {
            role: "student",
            status: { $ne: "disabled" },
            $or: clauses,
          },
          { projection: { _id: 0, id: 1, notifications: 1 } }
        )
        .toArray());
    }

    try {
      const givenAt = assignment.givenAt || assignment.createdAt;
      const isShortDeadline =
        new Date(assignment.deadline).getTime() - new Date(givenAt).getTime() < SHORT_DEADLINE_MS;
      const elapsedLabel = isShortDeadline ? "20 minutes" : "one hour";
      for (const student of recipients) {
        if (!getNotificationPreferences(student).dueReminders) continue;
        await notifyUserOnce(student.id, {
          id: `assignment-reminder:${assignment.id}:${student.id}:${assignment.reminderDueAt}`,
          title: `Assignment Reminder: ${assignment.title}`,
          message: `You received this assignment ${elapsedLabel} ago and the deadline is close. Open it to review the deadline.`,
          type: "assignment",
          link: "/student/assignments",
        });
      }
      await assignmentsCollection.updateOne(
        { id: assignment.id, reminderProcessedAt: { $exists: false } },
        { $set: { reminderProcessedAt: nowIso } }
      );
    } catch (err) {
      console.error(
        `Could not dispatch assignment reminder for ${assignment.id}:`,
        err.message
      );
    }
  }

  return assignments.length;
}

function startDeadlineReminderScheduler() {
  let reconciled = false;
  const run = async () => {
    try {
      if (!reconciled) {
        await reconcilePendingAssignmentReminders();
        reconciled = true;
      }
      await dispatchDueAssignmentReminders();
    } catch (err) {
      console.error("Deadline reminder check failed:", err.message);
    }
  };

  run();
  const timer = setInterval(run, REMINDER_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = {
  getAssignmentReminderDueAt,
  reconcilePendingAssignmentReminders,
  dispatchDueAssignmentReminders,
  startDeadlineReminderScheduler,
};
