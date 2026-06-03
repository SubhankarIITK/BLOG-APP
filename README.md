# Luma Journal

Luma is an AI-powered blog platform with public reading, account-based writing, MongoDB Atlas persistence, rich-text publishing, bookmarks, dashboards, and Groq writing assistance.

## Local Setup

```bash
npm install
copy .env.example .env
```

Open `.env` and set:

```dotenv
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/luma-journal?retryWrites=true&w=majority
MONGODB_DB=luma-journal
JWT_SECRET=make-this-a-long-random-string
GROQ_API_KEY=your_groq_key
```

Start the API:

```bash
npm run dev:api
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## App Behavior

- Anyone can open the site and read published public stories.
- Users must sign up or log in to write, publish, bookmark, or use the dashboard.
- Published stories are public immediately.
- Dashboard stories show only the logged-in user's own stories.
- Bookmarks are private per account.
- Rich-text formatting is stored with each story and sanitized before rendering.

## MongoDB Atlas

Use your Atlas connection string as `MONGODB_URI`. The app will create these collections automatically:

- `users`
- `stories`
- `bookmarks`

The API also seeds a demo account on an empty database:

```text
email: demo@luma.local
password: demo1234
```

## API

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Public | MongoDB and Groq status |
| `POST` | `/api/v1/auth/signup` | Public | Create account |
| `POST` | `/api/v1/auth/login` | Public | Login |
| `GET` | `/api/v1/auth/me` | User | Current user |
| `GET` | `/api/v1/stories` | Public | Published public stories |
| `GET` | `/api/v1/stories/mine` | User | Logged-in user's stories |
| `POST` | `/api/v1/stories` | User | Publish or draft a story |
| `PUT` | `/api/v1/stories/:id` | Owner | Edit own story |
| `DELETE` | `/api/v1/stories/:id` | Owner | Delete own story |
| `GET` | `/api/v1/bookmarks` | User | Private reading list |
| `POST` | `/api/v1/bookmarks/:storyId` | User | Toggle bookmark |
| `POST` | `/api/v1/ai/assist` | Public | Groq writing assistant |

## Production

```bash
npm run build
npm start
```

Docker:

```bash
docker build -t luma-journal .
docker run --env-file .env -p 8787:8787 luma-journal
```
