# Multi-Business Appointment Booking Platform

A full-stack Node.js + Express + MongoDB booking platform for service businesses, including clinics, gyms, tutors and other appointment-based providers. The project is designed to run locally for development and is ready to be deployed to Render/Railway for the backend and Vercel/Netlify for the frontend.

## Features
- Tenant-specific shop pages at `/shop/<business-slug>/`
- Admin dashboard for appointments, services, staff and business settings
- Secure admin login with JWT
- MongoDB-backed storage with Mongoose
- Configurable business details, facilities, testimonials, holidays and business/staff schedules
- Availability calculated and revalidated against the business schedule at booking time
- Payment flow with mock verification for local testing
- Contact form API for lead capture
- Responsive UI

## Project structure

```text
appointment_platform_full/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── seed.js
│   └── server.js
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── about.html
│   ├── booking.html
│   ├── contact.html
│   ├── dashboard.html
│   ├── index.html
│   ├── login.html
│   ├── payment-success.html
│   ├── payment-summary.html
│   ├── payment.html
│   └── services.html
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── .env
```

## Required software
- Node.js 18+
- MongoDB Atlas account or local MongoDB instance
- Git

## Install

```bash
npm install
```

## Environment variables
Create a `.env` file (copy from `.env.example`) and update values:

```bash
cp .env.example .env
```

Example:

```bash
PORT=5000
JWT_SECRET=your_super_secure_jwt_secret_here
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_platform
ADMIN_EMAIL=admin@business.com
ADMIN_PASSWORD=admin123
```

If `MONGODB_URI` is missing or left as a placeholder, the app will fall back to a local MongoDB database at `mongodb://127.0.0.1:27017/appointment_platform`.

## Run locally

```bash
npm start
```

Then open:
- http://localhost:5000/
- http://localhost:5000/login.html
- http://localhost:5000/dashboard.html

Each business has its own public URL at `http://localhost:5000/shop/<business-slug>/`. The dashboard displays the owner's public shop link. The root URL remains the legacy entry point for the first business.

## Seed default admin and sample data

```bash
npm run seed
```

`npm start` does not seed the database automatically. Start MongoDB, then run `npm run seed` once to create the default admin, business, services and staff. The seed associates the legacy unowned business with the default admin and assigns existing unscoped appointments, customers, reviews, payments, contact messages, services and staff to that business. It only creates default services/staff when that business has none. Edit all business-specific contact details and schedules from the dashboard.

MongoDB must be connected for business settings, bookings, contact submissions and payments to be saved. When the database is disconnected, these APIs return an error instead of reporting unsaved data as successful.

## Deployment

### Backend hosting
Use Render or Railway. Set these environment variables in your hosting dashboard:
- `PORT`
- `JWT_SECRET`
- `MONGODB_URI`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### Frontend hosting
Deploy the static front end to Vercel or Netlify and configure your public API base URL in `frontend/js/api.js` or in a build-time environment variable.

### GitHub workflow

```bash
git init
git add .
git commit -m "Initial project setup"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Notes
- Do not commit `.env` files or real database credentials.
- The payment flow uses a mock verification flow for development and testing. It is not a live production gateway.
- Replace the mock payment integration with Razorpay or a production gateway before production release.

## Troubleshooting

If MongoDB is not reachable:
- confirm the `MONGODB_URI` value is correct
- whitelist your IP in MongoDB Atlas
- or run a local MongoDB instance on port `27017`

If the backend does not respond:
- run `npm install`
- ensure Node.js is installed
- inspect the terminal logs for runtime errors
