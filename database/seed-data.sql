-- DreamHome Sample Data

USE dreamhome;

-- Insert Users
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
('admin@dreamhome.com', '$2a$10$xxxxxxxxxxx', 'Admin', 'User', '555-0001', 'admin'),
('john.staff@dreamhome.com', '$2a$10$xxxxxxxxxxx', 'John', 'Smith', '555-0002', 'staff'),
('jane.client@email.com', '$2a$10$xxxxxxxxxxx', 'Jane', 'Doe', '555-0003', 'client'),
('bob.client@email.com', '$2a$10$xxxxxxxxxxx', 'Bob', 'Johnson', '555-0004', 'client');

-- Insert Branches
INSERT INTO branches (branch_name, address, city, state, postal_code, phone) VALUES
('Downtown Branch', '123 Main St', 'New York', 'NY', '10001', '555-1000'),
('Uptown Branch', '456 Park Ave', 'New York', 'NY', '10002', '555-2000');

-- Insert Staff
INSERT INTO staff (user_id, employee_number, position, salary, branch_id) VALUES
(2, 'EMP001', 'Property Manager', 65000.00, 1);

-- Insert Properties
INSERT INTO properties (address, city, state, postal_code, property_type, bedrooms, bathrooms, square_feet, rent_amount, status, description, branch_id) VALUES
('789 Oak Street', 'New York', 'NY', '10003', 'apartment', 2, 1, 900, 2500.00, 'available', 'Modern 2-bedroom apartment in downtown', 1),
('321 Elm Avenue', 'New York', 'NY', '10004', 'house', 3, 2, 1500, 3500.00, 'available', 'Spacious family house with garden', 1),
('654 Pine Road', 'New York', 'NY', '10005', 'condo', 1, 1, 650, 1800.00, 'rented', 'Cozy studio condo near subway', 2);

-- Insert Clients
INSERT INTO clients (user_id, date_of_birth, preferred_contact) VALUES
(3, '1990-05-15', 'email'),
(4, '1985-08-22', 'phone');

-- Insert Sample Rentals
INSERT INTO rentals (property_id, client_id, staff_id, start_date, end_date, monthly_rent, deposit_amount, status) VALUES
(3, 1, 1, '2025-01-01', '2025-12-31', 1800.00, 3600.00, 'active');

-- Insert Sample Payments
INSERT INTO payments (rental_id, payment_date, amount, payment_method, status) VALUES
(1, '2025-01-01', 1800.00, 'bank_transfer', 'completed');