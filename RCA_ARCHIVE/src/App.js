import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./components/SearchBar";
import Stats from "./components/Stats";
import SubjectsList from "./components/SubjectsList";
import Login from "./components/Login";
import SubjectPage from "./components/SubjectPage";
import "./App.css";

function App() {
  const year1Subjects = [
    "Mathematics", "Physics", "Fundamentals of Programming", "Database",
    "English", "Networking", "PHP", "JavaScript", "Embedded Systems",
    "Web User Interface", "Graphical User Interface"
  ];

  const year2Subjects = [
    "Mathematics", "Physics", "Data Structures with C++", "Advanced Networking",
    "OOP and Web Development with Java", "Software Engineering", "Advanced Database",
    "English", "Embedded Systems (Integrate Hardware with Software)",
    "Web 3 with Solidity", "3D Modelling with Blender"
  ];

  const year3Subjects = [
    "Mathematics", "Physics", "Machine Learning with Python", "Cybersecurity",
    "DevOps", "English", "Intelligent Robotics and Some Embedded Systems",
    "Mobile Apps Development with React Native",
    "Information Technology with Project Management"
  ];

  return (
    <div className="app-container">
      <Navbar />

      <Routes>
        <Route path="/" element={
          <>
            <SearchBar />
            <Stats />
            <SubjectsList year={1} subjects={year1Subjects} />
            <SubjectsList year={2} subjects={year2Subjects} />
            <SubjectsList year={3} subjects={year3Subjects} />
          </>
        } />

        {/* Login & Signup — same page */}
        <Route path="/login" element={<Login />} />

        {/* Subject page — upload happens here */}
        <Route path="/subject/:year/:subject" element={<SubjectPage />} />
      </Routes>

      <footer className="footer">
        Rwanda Coding Academy Past Papers & Notes System — Years 1-3
      </footer>
    </div>
  );
}

export default App;