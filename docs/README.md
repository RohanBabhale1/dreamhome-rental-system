# DreamHome Rental Management System

A property rental management web application for clients and staff.

## Features

### Web Application
- Property browsing and search
- User registration and authentication
- Property viewing scheduling
- Rental management
- Responsive design with Material-UI
- Staff dashboard for property management
- Client management
- Viewing schedule management
- Maintenance request handling

## Technology Stack

### Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- bcrypt for password hashing

### Web Frontend
- React
- React Router
- Material-UI
- Axios

## Setup Instructions

### Database Setup

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed-data.sql
```

### Backend Setup

```bash
cd web-app/server
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### Frontend Setup

```bash
cd web-app/client
npm install
npm start
```

## Project Structure

```
dreamhome-rental-system/
├── database/           # SQL scripts
├── web-app/
│   ├── client/        # React frontend
│   └── server/        # Node.js backend
└── docs/              # Documentation
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user

### Properties
- GET `/api/properties` - Get all properties
- GET `/api/properties/:id` - Get property by ID
- GET `/api/properties/all` - Get all properties (staff)
- POST `/api/properties` - Add new property (staff)
- PUT `/api/properties/:id` - Update property (staff)
- DELETE `/api/properties/:id` - Delete property (staff)

### Viewings
- POST `/api/viewings` - Schedule viewing
- GET `/api/viewings/client/:clientId` - Get client viewings

### Rentals
- GET `/api/rentals/client/:clientId` - Get client rentals

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License