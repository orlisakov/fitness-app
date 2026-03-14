 

🏋️ Fitness Coach Management Platform

A full-stack web platform that allows fitness coaches to manage trainees, track progress, and generate personalized nutrition plans.

🌐 Live Application
https://fitness-app-wdsh.onrender.com

💻 Source Code
https://github.com/orlisakov/fitness-app


🚀 Overview

Fitness Coach Management Platform is a modern web application designed to help fitness coaches manage their trainees efficiently.

The system provides tools for:
	•	Managing trainee profiles
	•	Tracking body measurements
	•	Generating personalized nutrition plans
	•	Organizing workouts and training resources
	•	Secure authentication and role-based access

The application is built using a React frontend, Node.js / Express backend, and MongoDB cloud database, and is fully deployed online.


✨ Key Features

🔐 Authentication
	•	Secure login and registration
	•	JWT-based authentication
	•	Role-based access (Coach / Trainee)

👥 Trainee Management
	•	Add and manage trainees
	•	Store trainee nutrition targets
	•	Manage personal details and progress

📏 Measurements Tracking
	•	Track body measurements over time
	•	Save and manage historical data

🥗 Nutrition Planning
	•	Automatic meal plan generation
	•	Macronutrient distribution (protein / carbs / fats)
	•	Custom macro split per meal

🏋️ Workout Management
	•	Create and manage workouts
	•	Assign programs to trainees

📂 Resources Library
	•	Upload and store resources
	•	File storage using MongoDB GridFS
	•	Category-based organization


🧱 Tech Stack

Frontend
	•	React
	•	JavaScript (ES6)
	•	Axios
	•	CSS

Backend
	•	Node.js
	•	Express.js
	•	REST API architecture
	•	JWT Authentication

Database
	•	MongoDB Atlas
	•	Mongoose ODM
	•	GridFS file storage

Deployment
	•	Render (frontend + backend hosting)
	•	MongoDB Atlas (cloud database)


🏗 Architecture

Client → React Application
⬇
REST API → Node.js / Express Server
⬇
MongoDB Atlas Database

Authentication flow:

User Login → API Request → JWT Token → Protected Routes


📁 Project Structure

fitness-app
│
├── client
│   ├── src
│   ├── components
│   ├── pages
│   └── services
│
├── server
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   └── server.js
│
└── README.md



🔗 API Example

Login

POST /api/auth/login

Request

{
  "phone": "0540000000",
  "password": "123456"
}

Response

{
  "token": "JWT_TOKEN",
  "user": {
    "id": "USER_ID",
    "fullName": "User Name",
    "phone": "0540000000",
    "role": "coach"
  }
}



⚙️ Local Development

Clone the repository

git clone https://github.com/orlisakov/fitness-app.git

Install backend dependencies

cd server
npm install

Create .env file

MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000

Run the server

node server.js



🛣 Roadmap

Future improvements planned:
	•	Progress charts and analytics dashboard
	•	Mobile responsive UI improvements
	•	Notification system for trainees
	•	Advanced nutrition planning
	•	AI-assisted meal plan generation


👩‍💻 Author

Orli isakov bondarenko

GitHub
https://github.com/orlisakov


📌 Project Purpose

This project was built as a portfolio full-stack application to demonstrate practical experience in:
	•	Web application architecture
	•	Backend API development
	•	Authentication systems
	•	Database design
	•	Full deployment to production
:::
