import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

test("renders the home page banner", () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  expect(
    screen.getByText(/find your past papers & notes/i)
  ).toBeInTheDocument();
});
