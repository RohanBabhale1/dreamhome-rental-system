# DreamHome Requirements Specification

## Functional Requirements

### FR1: User Management
- FR1.1: System shall support user registration with email verification
- FR1.2: System shall support secure login with password hashing
- FR1.3: System shall support two user roles: client and staff

### FR2: Property Management
- FR2.1: Staff shall be able to add, edit, delete properties via web interface
- FR2.2: Clients shall be able to browse and search properties
- FR2.3: System shall support property filtering by location, type, price, bedrooms

### FR3: Rental Management
- FR3.1: Staff shall be able to create rental agreements
- FR3.2: System shall track rental start/end dates
- FR3.3: System shall calculate and track payments

### FR4: Viewing Management
- FR4.1: Clients shall be able to schedule property viewings
- FR4.2: Staff shall receive viewing notifications
- FR4.3: System shall prevent double-booking of viewings

## Non-Functional Requirements

### NFR1: Performance
- System shall respond to queries within 2 seconds
- System shall support 100 concurrent users

### NFR2: Security
- Passwords shall be hashed using bcrypt
- API shall use JWT for authentication
- Database connections shall use prepared statements

### NFR3: Usability
- Web interface shall be responsive
- Interface shall follow Material Design principles