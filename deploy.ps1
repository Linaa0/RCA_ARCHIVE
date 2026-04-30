
scp -r . nelson@10.12.72.100:/home/nelson//rca-past-papers

ssh nelson@10.12.72.100 "
  cd ~/rca-past-papers;

  # Install frontend dependencies
  npm install;

  # Install backend dependencies
  cd rcabackend;
  npm install;

  # Go back to root and start both frontend + backend
  cd ..;
  npm start;
"
