import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DataHubDashboard from "./pages/DataHubDashboard";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datahub" element={<DataHubDashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;