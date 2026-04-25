import React from "react";
import { Link } from "react-router-dom";
import "./upload.css";

function uploadFile(){
  return(
     <div className="dashboard-actions">
          <button className="action-btn">Upload New Paper / Note</button>
          <button className="action-btn">View All Papers</button>
        </div>
  )
}

export default uploadFile;