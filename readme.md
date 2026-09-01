# Authentication Backend Project

This project is a Node.js authentication system built with Express, MongoDB, Mongoose, JWT, and SHA-256 hashing. It includes user registration, login, refresh-token rotation, logout, logout-all, and Google authentication support.

The backend is organized around a simple authentication flow:

- Register a new user
- Create a session
- Issue an access token
- Store a refresh token in a secure cookie
- Rotate the refresh token when needed
- Revoke sessions on logout

---

## 1. Project Structure

```text
Authentication/
├── client/
├── server/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── config.js
│   │   ├── connections/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   └── auth.controller.js
│   │   ├── models/
│   │   │   ├── session.model.js
│   │   │   └── user.model.js
│   │   ├── routes/
│   │   │   └── auth.route.js
│   │   └── services/
│   │       └── google.service.js
│   ├── package.json
│   └── server.js
├── readme.md
├── tasks.txt
└── ...
```

This project separates responsibilities cleanly:

- `app.js` sets up Express middleware and route registration
- `auth.route.js` defines API endpoints
- `auth.controller.js` contains the auth logic
- `session.model.js` stores session information
- `user.model.js` stores user profile data
- `config.js` loads environment variables
- `database.js` handles MongoDB connection

---

## 2. Tech Stack

The current project uses:

- Express.js for API creation
- MongoDB + Mongoose for database management
- JWT for access and refresh tokens
- SHA-256 hashing for password and refresh-token storage
- cookie-parser for reading cookies
- CORS for browser cross-origin access
- Morgan for request logging

---

## 3. Authentication Flow Overview

The system uses two types of tokens:

### Access Token

- short-lived
- used for protected routes
- usually valid for a short time such as 10 minutes

### Refresh Token

- longer-lived
- used to generate a new access token when the previous access token expires
- stored in an HTTP-only cookie

### Why this design?

This reduces the risk of exposing a long-lived token to the browser and improves security by rotating tokens regularly.

---

## 4. Registration Flow

The registration endpoint creates a new account and immediately creates a session.

### Route

```http
POST /api/auth/register
```

### Flow

```text
User sends username, email, password
   ↓
Check if user already exists
   ↓
Hash password
   ↓
Create user in MongoDB
   ↓
Generate refresh token
   ↓
Hash refresh token
   ↓
Create session record
   ↓
Generate access token
   ↓
Set refresh token cookie
   ↓
Return success response
```

### Example request

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "myPassword123"
}
```

### Example behavior

If the user doesn't already exist:

- the password is hashed
- the user is saved
- a refresh token is generated using JWT
- the token is hashed before saving in the database
- a session record is created with the user id, token hash, IP, and browser details
- an access token is returned to the client

### Cookie example

```js
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: false,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

This cookie keeps the user logged in without exposing the refresh token to JavaScript.

---

## 5. Login Flow

### Route

```http
POST /api/auth/login
```

### Flow

```text
User sends email and password
   ↓
Find user by email
   ↓
Hash the incoming password
   ↓
Compare with stored hash
   ↓
If valid, generate refresh token
   ↓
Store refresh token hash in session
   ↓
Generate access token
   ↓
Set refreshToken cookie
   ↓
Return access token
```

### Example request

```json
{
  "email": "john@example.com",
  "password": "myPassword123"
}
```

### Success case

If the password matches:

- the user is authenticated
- a new session is created
- a refreshToken cookie is sent
- an access token is returned for API access

---

## 6. Refresh Token Flow

### Route

```http
POST /api/auth/refresh-token
```

### Flow

```text
Client sends refresh token from cookie or header
   ↓
Verify JWT token
   ↓
Hash the incoming refresh token
   ↓
Find matching session with revoked=false
   ↓
If session exists, generate new refresh token
   ↓
Update session hash
   ↓
Generate new access token
   ↓
Return new access token
```

### Example scenario

A user logs in and gets an access token valid for 10 minutes. After that time, the frontend sends the refresh token cookie to the server. The server verifies it and issues a new access token without forcing the user to log in again.

### Important detail

The server does not trust the refresh token blindly. It hashes it and compares the hash against the stored session value.

This prevents stolen or fake tokens from being accepted.

---

## 7. Logout Flow

### Route

```http
GET /api/auth/logout
```

### Flow

```text
Read refresh token from cookie or header
   ↓
Verify token
   ↓
Hash token and find valid session
   ↓
Set revoked = true
   ↓
Save session
   ↓
Clear refreshToken cookie
   ↓
Return success response
```

### Example scenario

A user clicks logout on the frontend. The backend reads the refresh token, validates it, finds the session, marks it as revoked, and removes the cookie from the browser.

Once the session is revoked, that refresh token can no longer be used to generate new access tokens.

---

## 8. Logout-All Flow

### Route

```http
GET /api/auth/logoutAll
```

### Flow

```text
Read refresh token from cookie
   ↓
Verify JWT
   ↓
Find all sessions for the user where revoked=false
   ↓
Set revoked=true for all sessions
   ↓
Clear cookie
   ↓
Return success response
```

### Example scenario

A user is logged in on multiple devices. If they choose logout all, the server invalidates all active sessions for that user across devices.

This is useful when:

- a device is lost
- the account may be compromised
- the user wants to revoke all active sessions at once

---

## 9. Google Login Flow

The project also supports Google-based login.

### Route

```http
POST /api/auth/google
```

### Flow

```text
Frontend sends Google ID token
   ↓
Backend verifies token with Google
   ↓
Extract user payload
   ↓
Check if Google user exists in database
   ↓
If not, create user record
   ↓
Generate refresh token
   ↓
Create session
   ↓
Generate access token
   ↓
Set refresh token cookie
   ↓
Return access token
```

### Example scenario

When a user clicks "Continue with Google":

- Google authenticates the user
- the frontend receives an ID token
- the backend verifies it
- the user is either found or created
- the app issues its own JWT access and refresh tokens

This means the app uses Google only for identity verification and still manages its own internal session tokens.

---

## 10. Session Model

The session model stores one session per login session.

```js
const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  refreshTokenHash: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  revoked: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });
```

### Why this matters

A refresh token is stored as a hash, not a plain string. That means even if the database is exposed, the actual token is not directly visible.

---

## 11. User Model

The user model contains the basic credential information.

```js
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String },
  googleId: { type: String },
  provider: { type: String, default: 'local' }
});
```

This supports both:

- local email/password authentication
- Google authentication

---

## 12. Environment Configuration

The project reads values from environment variables using `dotenv`.

```js
const config = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
};
```

### Required environment values

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID` (for Google login)

If any of these are missing, the app throws an error during startup.

---

## 13. API Endpoints Summary

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/login` | POST | Log in with email and password |
| `/api/auth/refresh-token` | POST | Create new access token using refresh token |
| `/api/auth/logout` | GET | Revoke current session |
| `/api/auth/logoutAll` | GET | Revoke all sessions for the user |
| `/api/auth/google` | POST | Login using Google ID token |

---

## 14. Security Notes

The current implementation follows a common secure pattern:

- passwords are hashed before storage
- refresh tokens are hashed before saving to MongoDB
- cookies are marked `httpOnly` so JavaScript cannot read them
- sameSite is set to `strict` to reduce CSRF risk
- access tokens are short-lived
- revoked sessions are invalidated

### Security best practices to keep in mind

1. Use HTTPS in production
2. Set `secure: true` in production when running behind HTTPS
3. Use a stronger password-hashing strategy if the project evolves further
4. Add route-level middleware for protected routes
5. Consider storing refresh token rotation metadata for better tracking

---

## 15. Important Implementation Notes

The project uses `crypto.createHash('sha256')` for hashing rather than bcrypt for the current token logic. This means the logic is intentionally simple and educational, but in production you may want to standardize hashing strategies depending on your security requirements.

Also, the refresh token is sent as a cookie; the frontend must include that cookie in browser requests or use the same-site mechanism supported by the app.

---

## 16. Typical Request Flow Example

```text
1. User registers
2. Server creates user record
3. Server creates refresh token
4. Browser stores refresh token in cookie
5. Server sends access token to client
6. Client uses access token on protected APIs
7. When access token expires, client uses refresh token
8. Server verifies refresh token and returns a new access token
9. User stays logged in without re-entering credentials
```

---

## 17. Summary

This authentication backend follows a standard and scalable session-based JWT flow:

- local signup/login
- secure cookie-based refresh token storage
- access token validation for protected requests
- session revocation on logout
- multi-device session support via logout-all
- Google sign-in support

It is a good foundation for a real-world authentication system and is structured in a way that is easy to extend with role-based access, email verification, password reset, and protected route middleware.
- IP address

This helps track where the token is being used.

---

## 11. MongoDB Query Notes

These are important concepts in the project:

### `find()`

Returns an array of matching documents.

Example:

```js
const sessions = await sessionModel.find({ revoked: false });
```

This returns many sessions.

### `findOne()`

Returns a single matching document or null.

Example:

```js
const user = await userModel.findOne({ email: req.body.email });
```

This is usually the better choice when you expect only one result.

### `findOne` vs `find`

- Use `findOne` when checking if a user exists by email or username
- Use `find` when retrieving multiple active sessions

---

## 12. Flow Diagram

```text
Register
   ↓
Create User
   ↓
Create Refresh Token
   ↓
Hash Refresh Token
   ↓
Store Hash in Session
   ↓
Create Access Token
   ↓
Set Cookie
   ↓
Return Response
```

```text
Refresh Token Request
   ↓
Read Cookie
   ↓
Verify JWT
   ↓
Hash Received Token
   ↓
Find Session
   ↓
Generate New Refresh Token
   ↓
Update Session Hash
   ↓
Generate New Access Token
```

```text
Logout
   ↓
Check Refresh Token
   ↓
Find Session
   ↓
revoke = true
   ↓
Save Session
   ↓
Clear Cookie
```

---

## 13. Real-World Example Scenarios

### Scenario 1: User logs in for the first time

- User signs up
- Server creates user and session
- Refresh token is saved in a secure cookie
- Access token is sent to frontend
- User can access protected routes

### Scenario 2: Access token expires

- User calls an authenticated route
- Access token is expired
- Backend checks refresh token
- Server issues a new access token without forcing re-login

### Scenario 3: User logs out from one device

- The specific device session is revoked
- That device cannot generate new tokens
- Other sessions remain active unless logout-all is used

### Scenario 4: User logs out from all devices

- All sessions for the same user become invalid
- All devices are signed out
- Security is improved if the account was compromised

### Scenario 5: Token tampering

If an attacker alters the refresh token:

- JWT verification fails
- server rejects request
- no session is matched
- request ends with error response

---

## 14. Example API Requests

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securePass123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "alice@example.com",
  "password": "securePass123"
}
```

### Refresh Token

```http
POST /api/auth/refresh-token
```

### Logout

```http
GET /api/auth/logout
```

---

## 15. Common Authentication Rules

1. Always verify refresh tokens before using them.
2. Always hash refresh tokens before storing them.
3. Always revoke sessions on logout.
4. Always use short-lived access tokens.
5. Always use secure cookies for refresh tokens.
6. Always validate user input before creating sessions.

---

## 16. Conclusion

This authentication system follows a secure and standard pattern:

- user registers or logs in
- JWT tokens are generated
- refresh tokens are stored securely in cookies
- sessions are tracked in MongoDB
- refresh tokens are rotated and revoked when needed
- access tokens remain short-lived for safer access management

This architecture is widely used in modern web applications because it balances security, convenience, and scalability.

---

## 17. Quick Summary

```text
Register => Create User => Create Session => Create Access Token => Store Refresh Cookie
Login => Verify Password => Create Session => Create Tokens
Refresh => Verify Refresh Token => Match Session => Issue New Tokens
Logout => Revoke Session => Clear Cookie
```

This is the complete authentication lifecycle used in the project.



