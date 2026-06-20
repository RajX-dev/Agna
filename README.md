# Agna 🪐

Agna is a premium, high-performance, glassmorphic desktop markdown editor built with **React**, **Vite**, and **Electron**, styled with native Windows 11 Acrylic materials. 

Agna bridges the gap between text-based markdown files and visual workspace management, offering integrated Kanban task boards, secure cryptographic file-locking, link preview overlays, and instant styled PDF sharing.

---

## Key Features

### 📋 Jira-Style Kanban Board
* Automatically parses standard markdown checklist checkboxes (`- [ ]` to **To Do**, `- [/]` to **In Progress**, and `- [x]` to **Done**) into interactive columns.
* Fully draggable cards with real-time status updates written directly back to the markdown note on disk.
* Inline renaming (contentEditable) and quick card addition/deletion.
* Automatically restricted to board-type notes (containing `<!-- type: board -->`), returning plain notes to standard editor layouts.

### 📝 Rich Formatting & Template Prompts
* Minimalist formatting toolbar in edit mode for inserting headers, lists, task checkmarks, code blocks, bold, and italic markers.
* Note Creation wizard prompted on `+` click or `Ctrl + T` to choose note name and select a visual template:
  * **Blank Note** / **Meeting Notes** (plain text pads).
  * **Blank Board** / **Jira Board** / **To-Do Board** (ready-made Kanban layouts).
* Selector grid customized with premium vector SVGs instead of standard emojis.

### 🔒 Cryptographically Secure Locked Notes
* Encrypt sensitive notes into secure `.agna` files.
* **Algorithm**: **AES-256-GCM** (Galois/Counter Mode) authenticated encryption offering military-grade confidentiality and file integrity verification.
* **Key Derivation**: **Scrypt** CPU/memory-hard derivation using cryptographically secure 16-byte random salts per note to protect against brute-force/rainbow table attacks.
* Notes are decrypted strictly in memory and are never saved to disk in plain text.

### 🔗 Wiki-Links & Web Preview Tabs
* Obsidian-style internal wiki-links (`[[Note Title]]`) automatically resolve and navigate to notes (or prompt note creation).
* Hovering over links displays glassmorphic preview cards (text snippets for internal notes, and YouTube video thumbnail previews for video links).
* Clicking a YouTube link opens an embedded player tab inside the editor's tab bar, enabling side-by-side video viewing and note-taking.

### 📤 WhatsApp PDF Sharing
* Convert notes into A4 PDFs that match the **exact layout and colors of Preview mode** using a hidden print rendering engine.
* PDF files are saved to `Documents/Agna` and copied directly to the Windows clipboard via a native PowerShell script.
* Automatically launches your native **WhatsApp Desktop App** (via `whatsapp://` URI protocol) for instant pasting (`Ctrl + V`) and sharing. Includes a fallback button for WhatsApp Web.

---

## Tech Stack & Architecture

* **Framework**: React 19 + Vite 8
* **Shell**: Electron 42 (configured with hidden title bars, custom traffic lights, and Windows 11 Acrylic materials)
* **Styling**: Vanilla CSS (glassmorphic dark/light systems, acrylic overlays, keyframe blur/shake animations)
* **Build System**: `electron-builder` for one-click setup installer packaging

---

## Installation Guide

### For Users (Installing the Standalone App)
If you want to run the standalone desktop app:
1. Currently, as a release is not yet published on GitHub, the installer can be built locally. Follow the **Developer Setup** below and run `npm run package`.
2. Navigate to the `dist-electron/` folder and locate `Agna Setup 0.1.0.exe`.
3. Double-click the `.exe` file to launch the installation wizard.
4. Follow the setup prompts to choose your preferences and installation directory.
5. The setup will create a desktop shortcut and a Start Menu entry. Launch **Agna** and start writing your notes!

*(Note: Once a public version is published, users will be able to download the installer directly from the [GitHub Releases](https://github.com/RajX-dev/Agna/releases) page.)*

---

## Developer Setup (Running from Source)

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* Windows OS (optimized for Windows 11 Acrylic backgrounds)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/RajX-dev/Agna.git
   cd Agna
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
To launch the application in development mode with HMR:
```bash
npm start
```
This runs the Vite dev server and spawns the Electron app concurrently.

### Building the Installer
To build the production frontend assets and bundle them into a standalone Windows installer (`.exe` setup):
```bash
npm run package
```
The distributable installer will be created inside the `dist-electron/` directory:
* `dist-electron/Agna Setup 0.1.0.exe`

### Releasing to GitHub

#### Option 1: Manual Release (Easiest)
1. Build the production installer locally:
   ```bash
   npm run package
   ```
2. Navigate to your GitHub Repository: `https://github.com/RajX-dev/Agna`.
3. In the right-hand sidebar, click on **Releases** (or visit `https://github.com/RajX-dev/Agna/releases`) and click **Draft a new release**.
4. Create a tag matching the version in `package.json` (e.g., `v0.1.0`), set the release title, and write a release description.
5. Drag and drop the generated installer executable (`dist-electron/Agna Setup 0.1.0.exe`) into the binaries attachment box.
6. Click **Publish release**.

#### Option 2: Automated Publish with `electron-builder`
You can publish releases directly from your command line using `electron-builder`:
1. Add the GitHub publisher configuration to your `package.json` under the `"build"` block:
   ```json
   "publish": {
     "provider": "github",
     "owner": "RajX-dev",
     "repo": "Agna"
   }
   ```
2. Generate a [GitHub Personal Access Token (classic)](https://github.com/settings/tokens) with `repo` scope permissions.
3. Run the publishing command in your terminal, passing the token:
   - **PowerShell (Windows)**:
     ```powershell
     $env:GH_TOKEN="your_personal_access_token"
     npx electron-builder --publish always
     ```
   - **Bash (Git Bash/Linux/macOS)**:
     ```bash
     GH_TOKEN="your_personal_access_token" npx electron-builder --publish always
     ```

---

## Cryptographic Locking Architecture

```
Plaintext Markdown Note
       │
       ▼
[ Scrypt Key Derivation ]  ◄── User Password + Random Salt (16 bytes)
       │
       ▼
   256-Bit Key ──► [ AES-256-GCM Cipher ] ◄── Random IV (12 bytes)
                           │
                           ▼
                  Secure JSON Payload (.agna)
                  ├── salt (hex)
                  ├── iv (hex)
                  ├── authTag (hex)
                  └── ciphertext (hex)
```
During decryption, the authentication tag (**Auth Tag**) is verified. If the file is altered on disk or the password is incorrect, the tag comparison fails, and the note remains locked.
