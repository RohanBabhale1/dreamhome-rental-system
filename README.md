# DreamHome - Property Rental Management System

A complete property rental management solution with web and desktop interfaces.

## What is DreamHome?

DreamHome helps real estate agencies manage their rental properties efficiently. It has two main parts:

- A website where clients can browse properties and book viewings
- A desktop app where staff can manage everything behind the scenes

## Why Two Different Apps?

We built it this way because clients and staff have different needs:
- Clients need something simple they can access from anywhere
- Staff need powerful tools with more features for daily operations

## What Can It Do?

### For Clients (Website)
- Browse available rental properties
- Search and filter by location, price, and number of rooms
- Create an account and log in securely
- Schedule property viewings
- View rental agreements and payment history
- Works great on phones, tablets, and computers

### For Staff (Desktop App)
- Add new properties to the system
- Update property details and availability
- Manage client information
- Create and track rental agreements
- Record payments
- Handle viewing schedules
- Track maintenance requests
- Generate reports

## What's Inside?

### The Tech Stack

**Backend (Server)**
- Node.js and Express for the API
- MySQL database for storing everything
- JWT for secure login sessions
- Password encryption for security

**Frontend (Website)**
- React for the user interface
- Material-UI for nice-looking components
- Responsive design that works on any screen size

**Desktop App**
- Built with JavaFX
- Direct connection to the database
- Runs on Windows, Mac, and Linux

## What You Need

Before you start, make sure you have:
- Node.js (version 14 or higher)
- MySQL (version 8 or higher)
- Java JDK 17
- Maven for building the Java app
- A code editor like VS Code
- At least 4GB of RAM on your computer

## How to Set It Up

### Step 1: Get the Code
```bash
git clone https://github.com/yourusername/dreamhome-rental-system.git
cd dreamhome-rental-system
```

### Step 2: Set Up the Database
```bash
# Start MySQL and run these commands
mysql -u root -p

# Then run the setup files
source database/schema.sql
source database/seed-data.sql
```

This creates all the tables you need and adds some sample data to play with.

### Step 3: Start the Backend
```bash
cd web-app/server
npm install
```

Create a file called `.env` and add your database info:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=dreamhome
JWT_SECRET=make-this-a-long-random-string
```

Then start it up:
```bash
npm run dev
```

### Step 4: Start the Website
Open a new terminal window:
```bash
cd web-app/client
npm install
npm start
```

The website should open automatically at http://localhost:3000

### Step 5: Run the Desktop App
Open another terminal:
```bash
cd desktop-app
mvn clean install
mvn javafx:run
```

You'll need to update the database connection details in the Java code first (look in `DatabaseConnection.java`).

## How It's Organized

```
dreamhome-rental-system/
├── database/              # Database setup files
├── web-app/
│   ├── server/           # Backend API (Node.js)
│   └── client/           # Website (React)
└── desktop-app/          # Staff application (JavaFX)
```

Each part has its own folder with its own dependencies and code.

## The Database

We use 9 main tables:
- Users and authentication
- Properties and their details
- Clients and staff information
- Rental agreements
- Payments
- Viewing schedules
- Maintenance requests
- Office branches

Everything is connected properly with foreign keys to keep data consistent.

## How the API Works

The backend provides these main endpoints:

**Authentication**
- Register a new account
- Log in and get an access token
- Token required for protected routes

**Properties**
- Get all available properties (with filters)
- Get details for a specific property
- Search by location, price, type, etc.

**Viewings**
- Schedule a new viewing
- Get upcoming viewings for a client
- Update viewing status

**Rentals**
- View rental history
- Get current rental details
- Track payment status

## Getting Started as a User

### If You're a Client
1. Go to the website (localhost:3000)
2. Click "Register" and create an account
3. Browse the properties page
4. Use filters to find what you're looking for
5. Click on a property to see more details
6. Schedule a viewing if you're interested

### If You're Staff
1. Open the desktop application
2. Log in with your staff account
3. You'll see the main dashboard
4. From there you can manage properties, clients, and rentals
5. Use the menu to navigate between different features

## Tips for Development

### Working on the Backend
The API code is in `web-app/server`. Main files:
- `server.js` - Entry point
- `routes/` - API endpoint definitions
- `config/` - Database connection setup

### Working on the Frontend
React code is in `web-app/client/src`. Key folders:
- `components/` - Reusable UI pieces
- `pages/` - Full page components
- `services/` - API communication

### Working on the Desktop App
JavaFX code is in `desktop-app/src/main/java`. Important:
- `controllers/` - Handle user interactions
- `models/` - Data structures
- `resources/fxml/` - UI layouts

## Common Issues

**Backend won't start?**
- Make sure MySQL is running
- Check your database credentials
- Verify port 5000 isn't already in use

**Website can't connect?**
- Confirm the backend is running on port 5000
- Check the API URL in your frontend code
- Look at the browser console for errors

**Desktop app crashes?**
- Verify Java 17 is installed
- Make sure the database is accessible
- Check for error messages in the terminal

## What's Next?

Some ideas for future improvements:
- Add email notifications
- Integrate payment processing
- Upload property photos
- Generate PDF reports
- Add a mobile app
- Advanced analytics dashboard

## A Few Notes

This is a learning project that demonstrates:
- Building a full-stack application
- Working with both web and desktop technologies
- Proper database design
- RESTful API development
- User authentication and security
- Responsive web design

Feel free to use this as a starting point for your own projects or as a portfolio piece. The code is meant to be readable and well-structured, so it's good for learning.

## Running Everything at Once

Once you've set everything up, you'll need three terminal windows:

**Terminal 1:**
```bash
cd web-app/server && npm run dev
```

**Terminal 2:**
```bash
cd web-app/client && npm start
```

**Terminal 3:**
```bash
cd desktop-app && mvn javafx:run
```

Then you're good to go! The website will be at localhost:3000, the API at localhost:5000, and the desktop app will open in a new window.

## Built With

Node.js • React • JavaFX • MySQL • Express • Material-UI • Maven

---

Made as a demonstration of full-stack development with hybrid interfaces.