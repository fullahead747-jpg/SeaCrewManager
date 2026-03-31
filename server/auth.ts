import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { type Express } from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import pg from "pg";

const scryptAsync = promisify(scrypt);
const PostgresStore = connectPgSimple(session);

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
    // Check if the stored password looks like it's NOT hashed (no dot separator)
    if (!stored || !stored.includes(".")) {
      console.warn(`[AUTH-WARNING] User password is not in hashed format. Attempting plain-text comparison.`);
      return supplied === stored;
    }

    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('helium') ? false : { rejectUnauthorized: false }
    });

    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "seacrewmanager-secret-key",
        resave: false,
        saveUninitialized: false,
        store: new PostgresStore({
            pool,
            tableName: "session",
            createTableIfMissing: true,
        }),
        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax",
        },
    };

    if (app.get("env") === "production") {
        app.set("trust proxy", 1); // Required for cookies to work behind a proxy
    }

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                console.log(`[AUTH-DEBUG] Attempting login for user: ${username}`);
                const user = await storage.getUserByUsername(username);
                
                if (!user) {
                    console.log(`[AUTH-DEBUG] User not found: ${username}`);
                    return done(null, false, { message: "Invalid username or password" });
                }
                
                const isMatch = await comparePasswords(password, user.password);
                if (!isMatch) {
                    console.log(`[AUTH-DEBUG] Password mismatch for user: ${username}`);
                    return done(null, false, { message: "Invalid username or password" });
                }
                
                console.log(`[AUTH-DEBUG] Authentication successful for: ${username} (Role: ${user.role})`);
                return done(null, user);
            } catch (err) {
                console.error(`[AUTH-DEBUG] Error in LocalStrategy for ${username}:`, err);
                return done(err);
            }
        }),
    );

    passport.serializeUser((user, done) => {
        done(null, (user as User).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });

    app.post("/api/register", async (req, res, next) => {
        try {
            const existingUser = await storage.getUserByUsername(req.body.username);
            if (existingUser) {
                return res.status(400).send("Username already exists");
            }

            const hashedPassword = await hashPassword(req.body.password);
            const user = await storage.createUser({
                ...req.body,
                password: hashedPassword,
            });

            req.login(user, (err) => {
                if (err) return next(err);
                res.status(201).json(user);
            });
        } catch (err) {
            next(err);
        }
    });

    app.post("/api/login", (req, res, next) => {
        console.log(`[AUTH-DEBUG] POST /api/login request received`);
        passport.authenticate("local", (err: any, user: any, info: any) => {
            if (err) {
                console.error(`[AUTH-DEBUG] Passport authentication error:`, err);
                return next(err);
            }
            if (!user) {
                console.log(`[AUTH-DEBUG] Passport authentication failed: ${info?.message}`);
                return res.status(401).json({ message: info?.message || "Login failed" });
            }
            req.login(user, (err) => {
                if (err) {
                    console.error(`[AUTH-DEBUG] req.login error:`, err);
                    return next(err);
                }
                console.log(`[AUTH-DEBUG] User ${user.username || user.id} logged in successfully`);
                res.status(200).json(user);
            });
        })(req, res, next);
    });

    app.post("/api/logout", (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.sendStatus(200);
        });
    });

    app.get("/api/user", (req, res) => {
        if (!req.isAuthenticated()) return res.sendStatus(401);
        res.json(req.user);
    });
}
