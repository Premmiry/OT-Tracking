# OT Tracking System Backend

ระบบ Backend สำหรับจัดการการติดตาม OT และการขอชดเชยวันหยุด พัฒนาด้วย **FastAPI** และใช้ **uv** ในการจัดการ dependencies

## 📋 Prerequisites

- **Python** (>= 3.9)
- **uv** (An extremely fast Python package installer and resolver, written in Rust)

### การติดตั้ง uv

หากยังไม่ได้ติดตั้ง `uv` สามารถติดตั้งได้ด้วยคำสั่ง:

**Windows (PowerShell):**
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## 🚀 การติดตั้งและเริ่มใช้งาน

1. **Clone Repository** และเข้าไปที่โฟลเดอร์ `backend`:
   ```bash
   cd backend
   ```

2. **สร้าง Virtual Environment และติดตั้ง Dependencies:**
   เพียงแค่รันคำสั่ง `uv sync` ระบบจะสร้าง venv และติดตั้งทุกอย่างให้โดยอัตโนมัติตามไฟล์ `pyproject.toml`
   ```bash
   uv sync
   ```

3. **ตั้งค่า Environment Variables:**
   ตรวจสอบไฟล์ `.env` ว่ามีค่าที่จำเป็นครบถ้วน (เช่น Google Sheets Credentials, JWT Secret)
   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY=...
   GOOGLE_SHEET_ID=...
   JWT_SECRET=...
   ```

4. **รัน Server (Development Mode):**
   ใช้คำสั่ง `uv run` เพื่อรันคำสั่งภายใต้ environment ที่ตั้งค่าไว้
   ```bash
   uv run uvicorn main:app --reload
   ```
   *Server จะทำงานที่ `http://localhost:8000`*

---

## 🛠️ โครงสร้างโปรเจค

- **`main.py`**: จุดเริ่มต้นของ Application (FastAPI app instance)
- **`database.py`**: จัดการการเชื่อมต่อกับ Google Sheets
- **`routers/`**: แยกส่วนการทำงานของ API
  - `auth.py`: ระบบ Login/Authentication (JWT)
  - `attendance.py`: ดึงข้อมูลการลงเวลาทำงาน
  - `offsets.py`: จัดการการขอชดเชยวันหยุด (Offset)
  - `settings.py`: ตั้งค่าระบบ (วันลา, เวลาเข้างาน)
  - `audit.py`: บันทึกการกระทำของผู้ดูแลระบบ
- **`pyproject.toml`**: ไฟล์กำหนด Dependencies ของโปรเจค (มาตรฐานใหม่แทน requirements.txt)

## 📦 การจัดการ Dependencies

หากต้องการเพิ่ม Library ใหม่ ให้ใช้คำสั่ง `uv add`:
```bash
uv add <package_name>
```
ตัวอย่าง:
```bash
uv add pandas
```
ระบบจะอัปเดตไฟล์ `pyproject.toml` และ `uv.lock` ให้โดยอัตโนมัติ

---

## 🔑 API Documentation

เมื่อรัน Server แล้ว สามารถดูเอกสาร API ได้ที่:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
