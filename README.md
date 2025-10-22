# JobScout – Real-Time Job Board

[![Live Demo](https://img.shields.io/badge/🌍%20Live%20Demo-Click%20Here-brightgreen?style=for-the-badge)](https://jobscout-cf6d.onrender.com)


## 📖 About

**JobScout** is a modern, web-based job board that fetches the **latest job opportunities** directly from **LinkedIn and Indeed**.
It focuses on **junior**, **entry-level**, and **internship** positions, giving job seekers the most relevant, recent opportunities in their chosen location and field.

This platform combines a React frontend with a Node.js/Express backend and leverages Puppeteer to scrape LinkedIn jobs efficiently while respecting modern server constraints.


<img width="1603" height="605" alt="image" src="https://github.com/user-attachments/assets/ae589dc5-1fa8-44cb-9ea4-af1775265c65" />


<img width="1310" height="777" alt="image" src="https://github.com/user-attachments/assets/d991d48d-81a0-405a-a155-646df897045d" />




## Features

Real-Time Job Fetching: Scrapes LinkedIn for the latest postings in the last 24 hours.

Junior & Entry-Level Focus: Only fetches Internship, Entry-Level, and Junior positions.

Search by Keyword & Location: Users can search for jobs by title and location.

Responsive Design: Works seamlessly on desktop, tablet, and mobile devices.

Loading Feedback: Provides animated loading indicators while jobs are fetched.

Rate Limiting: Prevents excessive requests to the backend for stability.

Technologies Used

## Frontend:

React.js

Bootstrap 5

HTML5 / CSS3

## Backend:

Node.js / Express.js

Puppeteer / Puppeteer-Core

@sparticuz/chromium (for server-safe scraping)

CORS & Rate-Limiting Middleware

Deployment:

Render (Fullstack hosting for frontend + backend)
