import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

// Google Sheets Configuration
const rawEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

function parseGoogleEmail(email: string): string {
  let e = email.trim();
  if (e.includes('"client_email"')) {
    const match = e.match(/"client_email":\s*"([^"]+)"/);
    if (match) e = match[1];
  }
  return e.replace(/^["']|["']$/g, '');
}

function parseGoogleKey(key: string): string {
  if (!key) return "";
  
  let k = key.trim();
  
  // 1. Handle literal \n and \r\n first (common when copying from JSON or shell)
  k = k.replace(/\\n/g, '\n').replace(/\\r/g, '');
  
  // 2. If it's wrapped in quotes, remove them
  k = k.replace(/^["']|["']$/g, '');

  // 3. If it looks like a JSON object, try to extract the private_key field
  if (k.startsWith('{') || k.includes('"private_key"')) {
    try {
      // Try to parse as JSON if it looks like it
      const jsonStr = k.startsWith('{') ? k : `{${k.split('{')[1] || k}`;
      const parsed = JSON.parse(jsonStr);
      if (parsed.private_key) k = parsed.private_key;
    } catch (e) {
      // Fallback to regex if it's a partial JSON or malformed
      const match = k.match(/"private_key":\s*"([^"]+)"/);
      if (match) k = match[1];
    }
    // Re-handle newlines after extraction from JSON
    k = k.replace(/\\n/g, '\n').replace(/\\r/g, '');
  }

  // 3b. Special case: If the key starts with 'n' or 'rn' followed by 'MII', 
  // it's likely a mangled newline from a JSON copy-paste error.
  if (!k.includes("BEGIN")) {
    if (k.startsWith('nMII')) k = k.substring(1);
    else if (k.startsWith('rnMII')) k = k.substring(2);
  }

  // 4. Normalize markers but PRESERVE the type (RSA or not)
  // We look for the existing markers to determine the type
  const rsaMatch = k.match(/-+BEGIN (RSA )?PRIVATE KEY-+/);
  const beginMarker = rsaMatch ? rsaMatch[0] : "-----BEGIN PRIVATE KEY-----";
  const endMarker = beginMarker.replace("BEGIN", "END");

  // 5. Find the markers and extract content
  let bIdx = k.indexOf(beginMarker);
  let eIdx = k.indexOf(endMarker);
  
  if (bIdx !== -1 && eIdx !== -1) {
    let content = k.substring(bIdx + beginMarker.length, eIdx).trim();
    // Clean up all internal whitespace/newlines
    const base64 = content.replace(/\s/g, '');
    // Re-wrap to 64-char lines (PEM standard)
    const wrapped = base64.match(/.{1,64}/g)?.join('\n') || base64;
    return `${beginMarker}\n${wrapped}\n${endMarker}\n`;
  }

  // 6. If no markers found, but it's long enough to be a key, try to wrap it as standard PRIVATE KEY
  const cleaned = k.replace(/\s/g, '');
  if (cleaned.length > 100) {
    const wrapped = cleaned.match(/.{1,64}/g)?.join('\n') || cleaned;
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
  }
  
  return k;
}

const GOOGLE_SERVICE_ACCOUNT_EMAIL = parseGoogleEmail(rawEmail);
const GOOGLE_PRIVATE_KEY = parseGoogleKey(rawKey);

let doc: GoogleSpreadsheet | null = null;
let lastInitError: string | null = null;

// Initialize Database (Google Sheets)
async function initDb() {
  lastInitError = null;
  const missing = [];
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!GOOGLE_PRIVATE_KEY) missing.push("GOOGLE_PRIVATE_KEY");
  if (!GOOGLE_SHEET_ID) missing.push("GOOGLE_SHEET_ID");

  if (missing.length > 0) {
    lastInitError = `Missing environment variables: ${missing.join(", ")}. Please set them in the Secrets panel.`;
    console.error(lastInitError);
    return;
  }

  try {
    let sheetId = GOOGLE_SHEET_ID || "";
    // If user pasted the full URL, extract the ID
    if (sheetId.includes("docs.google.com/spreadsheets/d/")) {
      const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        sheetId = match[1];
        console.log("Extracted Sheet ID from URL:", sheetId);
      }
    }

    console.log("Attempting to initialize Google Sheets with ID:", sheetId);
    console.log("Service Account Email:", GOOGLE_SERVICE_ACCOUNT_EMAIL);
    
    if (GOOGLE_PRIVATE_KEY) {
      if (!GOOGLE_PRIVATE_KEY.includes("BEGIN") || !GOOGLE_PRIVATE_KEY.includes("PRIVATE KEY")) {
        console.error("Key format error: Missing proper PEM header");
        const actualStart = GOOGLE_PRIVATE_KEY.substring(0, 50).replace(/\n/g, '\\n');
        lastInitError = `Invalid Private Key format. Missing header. Your key starts with: "${actualStart}". Make sure to include the full key including BEGIN/END lines.`;
        doc = null;
        return;
      }
    }

    const auth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const newDoc = new GoogleSpreadsheet(sheetId, auth);
    await newDoc.loadInfo();
    console.log("Successfully loaded sheet info for:", newDoc.title);

    const sheets = [
      { title: "users", headerValues: ["id", "username", "password_hash", "role", "created_at"] },
      { title: "audit_logs", headerValues: ["id", "user_id", "action", "table_name", "record_id", "old_values", "new_values", "timestamp"] },
      { title: "settings", headerValues: ["user_id", "month", "year", "key", "value"] },
      { title: "attendance", headerValues: ["id", "user_id", "date", "type", "shift_start", "shift_end", "actual_start", "actual_end", "late_minutes", "early_minutes", "ot_minutes", "notes"] },
      { title: "offsets", headerValues: ["id", "user_id", "ot_attendance_id", "offset_attendance_id", "minutes_used"] },
    ];

    for (const sheetInfo of sheets) {
      let sheet = newDoc.sheetsByTitle[sheetInfo.title];
      if (!sheet) {
        sheet = await newDoc.addSheet({ title: sheetInfo.title, headerValues: sheetInfo.headerValues });
        console.log(`Created sheet: ${sheetInfo.title}`);
        
        // Seed default settings (global)
        if (sheetInfo.title === "settings") {
          const defaultSettings = [
            { user_id: "0", month: "0", year: "0", key: "sick_leave_total", value: "30" },
            { user_id: "0", month: "0", year: "0", key: "vacation_leave_total", value: "10" },
            { user_id: "0", month: "0", year: "0", key: "default_shift_start", value: "08:00" },
            { user_id: "0", month: "0", year: "0", key: "default_shift_end", value: "17:00" },
          ];
          await sheet.addRows(defaultSettings);
        }
      } else {
        // Ensure headers are up to date
        await sheet.loadHeaderRow();
        const currentHeaders = sheet.headerValues;
        const missingHeaders = sheetInfo.headerValues.filter(h => !currentHeaders.includes(h));
        if (missingHeaders.length > 0) {
          console.log(`Updating headers for ${sheetInfo.title}: adding ${missingHeaders.join(", ")}`);
          await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
      }
    }

    doc = newDoc;
    console.log("Google Sheets database initialized successfully");
  } catch (err: any) {
    console.error("Failed to initialize Google Sheets database:", err);
    
    let friendlyError = err.message || String(err);
    
    if (friendlyError.includes("403") || friendlyError.toLowerCase().includes("permission")) {
      friendlyError = `Permission Denied (403). You MUST share your Google Sheet with the service account email: ${GOOGLE_SERVICE_ACCOUNT_EMAIL} as an "Editor".`;
    } else if (friendlyError.includes("404")) {
      friendlyError = `Sheet Not Found (404). Please check if GOOGLE_SHEET_ID is correct: ${GOOGLE_SHEET_ID}`;
    } else if (friendlyError.includes("invalid_grant")) {
      friendlyError = `Invalid Credentials (invalid_grant). This usually means the Private Key or Service Account Email is incorrect.`;
    } else if (friendlyError.includes("DECODER routines::unsupported")) {
      friendlyError = `Invalid Private Key format (DECODER unsupported). This usually means the key is malformed, has extra spaces, or is missing the BEGIN/END lines. Make sure you copy the ENTIRE private key including the BEGIN and END lines.`;
    }
    
    lastInitError = friendlyError;
    doc = null;
  }
}

async function startServer() {
  await initDb();

  const app = express();
  const PORT = 5000;

  app.use(express.json());

  // Health Check
  app.get("/api/health", (req, res) => {
    const configStatus = {
      hasEmail: !!GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasKey: !!GOOGLE_PRIVATE_KEY,
      hasSheetId: !!GOOGLE_SHEET_ID,
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL || "missing",
      sheetId: GOOGLE_SHEET_ID || "missing"
    };

    res.json({ 
      status: "ok", 
      dbConnected: !!doc,
      config: configStatus,
      lastError: lastInitError,
      message: doc ? "Database is connected" : `Database is NOT connected. ${lastInitError ? "Error: " + lastInitError : "Check environment variables."}`
    });
  });

  // Debug Re-init
  app.post("/api/debug/reinit", async (req, res) => {
    await initDb();
    res.json({ success: !!doc, error: lastInitError, message: doc ? "Re-initialized successfully" : `Failed: ${lastInitError}` });
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  // Audit Logging Helper
  const logAudit = async (userId: number | undefined, action: string, tableName?: string, recordId?: string, oldValues?: any, newValues?: any) => {
    try {
      if (!doc) return;
      const sheet = doc.sheetsByTitle["audit_logs"];
      const rows = await sheet.getRows();
      const nextId = rows.length > 0 ? Math.max(...rows.map(r => parseInt(r.get("id")))) + 1 : 1;
      
      await sheet.addRow({
        id: nextId,
        user_id: userId || "",
        action,
        table_name: tableName || "",
        record_id: recordId || "",
        old_values: JSON.stringify(oldValues || {}),
        new_values: JSON.stringify(newValues || {}),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to log audit:", err);
    }
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    console.log("Registration attempt for:", req.body.username);
    try {
      if (!doc) {
        console.error("Registration failed: Database not initialized");
        return res.status(500).json({ 
          error: `Database not initialized. ${lastInitError ? "Error: " + lastInitError : "Please check your Google Sheets configuration."}` 
        });
      }
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const sheet = doc.sheetsByTitle["users"];
      const rows = await sheet.getRows();
      
      if (rows.find(r => r.get("username") === username)) {
        console.warn(`Registration failed: Username ${username} already exists`);
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const nextId = rows.length > 0 ? Math.max(...rows.map(r => {
        const id = parseInt(r.get("id"));
        return isNaN(id) ? 0 : id;
      })) + 1 : 1;
      
      const newUser = {
        id: nextId,
        username,
        password_hash: hashedPassword,
        role: "user",
        created_at: new Date().toISOString(),
      };
      
      await sheet.addRow(newUser);
      console.log(`User registered successfully: ${username} (ID: ${nextId})`);
      res.json({ id: newUser.id, username: newUser.username, role: newUser.role });
    } catch (err: any) {
      console.error("Detailed registration error:", err);
      res.status(500).json({ error: `Failed to register user: ${err.message || "Unknown error"}` });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    console.log("Login attempt for:", req.body.username);
    try {
      if (!doc) {
        console.error("Login failed: Database not initialized");
        return res.status(500).json({ 
          error: `Database not initialized. ${lastInitError ? "Error: " + lastInitError : "Please check your Google Sheets configuration."}` 
        });
      }
      const { username, password } = req.body;
      const sheet = doc.sheetsByTitle["users"];
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get("username") === username);

      if (userRow && await bcrypt.compare(password, userRow.get("password_hash"))) {
        const user = {
          id: parseInt(userRow.get("id")),
          username: userRow.get("username"),
          role: userRow.get("role"),
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
        console.log(`User logged in successfully: ${username}`);
        res.json({ token, user });
      } else {
        console.warn(`Login failed: Invalid credentials for ${username}`);
        res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (err: any) {
      console.error("Detailed login error:", err);
      res.status(500).json({ error: `Failed to login: ${err.message || "Unknown error"}` });
    }
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  // API Routes
  app.get("/api/settings", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const { month, year } = req.query;
      const sheet = doc.sheetsByTitle["settings"];
      const rows = await sheet.getRows();
      
      // Filter by user_id or global (user_id="0")
      const userRows = rows.filter(r => r.get("user_id") === String(req.user.id) || r.get("user_id") === "0");
      
      // Build settings object with overrides
      // Priority: Specific Month > User Global > System Global
      const settingsObj: any = {};
      
      // 1. System Global
      userRows.filter(r => r.get("user_id") === "0").forEach(r => {
        settingsObj[r.get("key")] = r.get("value");
      });
      
      // 2. User Global (month=0, year=0)
      userRows.filter(r => r.get("user_id") === String(req.user.id) && r.get("month") === "0").forEach(r => {
        settingsObj[r.get("key")] = r.get("value");
      });
      
      // 3. Specific Month
      if (month && year) {
        userRows.filter(r => 
          r.get("user_id") === String(req.user.id) && 
          r.get("month") === String(month) && 
          r.get("year") === String(year)
        ).forEach(r => {
          settingsObj[r.get("key")] = r.get("value");
        });
      }
      
      res.json(settingsObj);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const { month, year, ...updates } = req.body;
      const sheet = doc.sheetsByTitle["settings"];
      const rows = await sheet.getRows();

      const m = month || "0";
      const y = year || "0";

      for (const [key, value] of Object.entries(updates)) {
        const row = rows.find(r => 
          r.get("user_id") === String(req.user.id) && 
          r.get("month") === String(m) && 
          r.get("year") === String(y) && 
          r.get("key") === key
        );
        
        if (row) {
          row.set("value", String(value));
          await row.save();
        } else {
          await sheet.addRow({ 
            user_id: String(req.user.id), 
            month: String(m), 
            year: String(y), 
            key, 
            value: String(value) 
          });
        }
      }
      await logAudit(req.user.id, "UPDATE_SETTINGS", "settings", undefined, undefined, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/attendance", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const { month, year } = req.query;
      const sheet = doc.sheetsByTitle["attendance"];
      const rows = await sheet.getRows();
      
      let attendance = rows
        .filter(r => r.get("user_id") === String(req.user.id))
        .map(r => ({
          id: parseInt(r.get("id")),
          date: r.get("date"),
          type: r.get("type"),
          shift_start: r.get("shift_start"),
          shift_end: r.get("shift_end"),
          actual_start: r.get("actual_start"),
          actual_end: r.get("actual_end"),
          late_minutes: parseInt(r.get("late_minutes") || "0"),
          early_minutes: parseInt(r.get("early_minutes") || "0"),
          ot_minutes: parseInt(r.get("ot_minutes") || "0"),
          notes: r.get("notes"),
        }));

      if (month && year) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        attendance = attendance.filter(a => a.date.startsWith(prefix));
      }
      
      attendance.sort((a, b) => a.date.localeCompare(b.date));
      res.json(attendance);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const record = req.body;
      const sheet = doc.sheetsByTitle["attendance"];
      const rows = await sheet.getRows();
      
      const existingRow = rows.find(r => 
        r.get("user_id") === String(req.user.id) && 
        r.get("date") === record.date
      );
      let recordId: string;

      if (existingRow) {
        existingRow.assign({
          type: record.type,
          shift_start: record.shift_start,
          shift_end: record.shift_end,
          actual_start: record.actual_start,
          actual_end: record.actual_end,
          late_minutes: record.late_minutes || 0,
          early_minutes: record.early_minutes || 0,
          ot_minutes: record.ot_minutes || 0,
          notes: record.notes || "",
        });
        await existingRow.save();
        recordId = existingRow.get("id");
      } else {
        const allRows = await sheet.getRows();
        const nextId = allRows.length > 0 ? Math.max(...allRows.map(r => parseInt(r.get("id")))) + 1 : 1;
        recordId = String(nextId);
        await sheet.addRow({
          id: recordId,
          user_id: String(req.user.id),
          date: record.date,
          type: record.type,
          shift_start: record.shift_start,
          shift_end: record.shift_end,
          actual_start: record.actual_start,
          actual_end: record.actual_end,
          late_minutes: record.late_minutes || 0,
          early_minutes: record.early_minutes || 0,
          ot_minutes: record.ot_minutes || 0,
          notes: record.notes || "",
        });
      }
      
      await logAudit(req.user.id, "SAVE_ATTENDANCE", "attendance", recordId, undefined, record);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save attendance" });
    }
  });

  app.get("/api/offsets", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const offsetSheet = doc.sheetsByTitle["offsets"];
      const attendanceSheet = doc.sheetsByTitle["attendance"];
      
      const offsetRows = await offsetSheet.getRows();
      const attendanceRows = await attendanceSheet.getRows();
      
      const userAttendanceRows = attendanceRows.filter(r => r.get("user_id") === String(req.user.id));
      const attendanceMap = userAttendanceRows.reduce((acc, row) => {
        acc[row.get("id")] = row.get("date");
        return acc;
      }, {} as Record<string, string>);

      const offsets = offsetRows
        .filter(r => r.get("user_id") === String(req.user.id))
        .map(r => ({
          id: parseInt(r.get("id")),
          ot_attendance_id: parseInt(r.get("ot_attendance_id")),
          offset_attendance_id: parseInt(r.get("offset_attendance_id")),
          minutes_used: parseInt(r.get("minutes_used")),
          ot_date: attendanceMap[r.get("ot_attendance_id")],
          offset_date: attendanceMap[r.get("offset_attendance_id")],
        }));

      res.json(offsets);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch offsets" });
    }
  });

  app.post("/api/offsets", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const { ot_attendance_id, offset_attendance_id, minutes_used } = req.body;
      
      const attendanceSheet = doc.sheetsByTitle["attendance"];
      const attendanceRows = await attendanceSheet.getRows();
      
      const otRow = attendanceRows.find(r => r.get("user_id") === String(req.user.id) && r.get("id") === String(ot_attendance_id));
      const offsetRow = attendanceRows.find(r => r.get("user_id") === String(req.user.id) && r.get("id") === String(offset_attendance_id));
      
      if (!otRow || !offsetRow) {
        return res.status(404).json({ error: "Attendance record not found" });
      }

      if (new Date(otRow.get("date")) >= new Date(offsetRow.get("date"))) {
        return res.status(400).json({ error: "OT date must be before the offset date" });
      }

      const offsetSheet = doc.sheetsByTitle["offsets"];
      const offsetRows = await offsetSheet.getRows();
      const nextId = offsetRows.length > 0 ? Math.max(...offsetRows.map(r => parseInt(r.get("id")))) + 1 : 1;
      
      await offsetSheet.addRow({
        id: nextId,
        user_id: String(req.user.id),
        ot_attendance_id,
        offset_attendance_id,
        minutes_used,
      });
      
      await logAudit(req.user.id, "CREATE_OFFSET", "offsets", String(nextId), undefined, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save offset" });
    }
  });

  app.delete("/api/offsets/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      const sheet = doc.sheetsByTitle["offsets"];
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get("id") === req.params.id);
      
      if (row) {
        await row.delete();
        await logAudit(req.user.id, "DELETE_OFFSET", "offsets", req.params.id);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Offset not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to delete offset" });
    }
  });

  app.get("/api/audit", authenticateToken, async (req: any, res) => {
    try {
      if (!doc) return res.status(500).json({ error: "Database not initialized" });
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const auditSheet = doc.sheetsByTitle["audit_logs"];
      const userSheet = doc.sheetsByTitle["users"];
      
      const auditRows = await auditSheet.getRows();
      const userRows = await userSheet.getRows();
      
      const userMap = userRows.reduce((acc, row) => {
        acc[row.get("id")] = row.get("username");
        return acc;
      }, {} as Record<string, string>);

      const logs = auditRows.map(r => ({
        id: parseInt(r.get("id")),
        user_id: r.get("user_id"),
        username: userMap[r.get("user_id")] || "Unknown",
        action: r.get("action"),
        table_name: r.get("table_name"),
        record_id: r.get("record_id"),
        old_values: JSON.parse(r.get("old_values") || "{}"),
        new_values: JSON.parse(r.get("new_values") || "{}"),
        timestamp: r.get("timestamp"),
      }));

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(logs.slice(0, 100));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
