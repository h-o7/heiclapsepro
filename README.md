# HEIC Batch Converter & Timelapse Studio

A fully private, browser-sealed tool designed for batch converting HEIC formatted photos taken by iOS/Samsung mobile devices into high-quality JPEGs, featuring dynamic resizing options, a quality optimization engine, and a premium visual timeline builder to compile photos directly into stunning browser-based timelapses or stop-motion style previews.

---

## 🌐 Live Web Access

You can access and use this application directly in any web browser:
*   **Shared App (Production Preview)**: [https://ais-pre-pz4f5fpdaioh7lsvccffhl-593733727083.us-east1.run.app](https://ais-pre-pz4f5fpdaioh7lsvccffhl-593733727083.us-east1.run.app)
*   **Development Sandbox (Live Dev Build)**: [https://ais-dev-pz4f5fpdaioh7lsvccffhl-593733727083.us-east1.run.app](https://ais-dev-pz4f5fpdaioh7lsvccffhl-593733727083.us-east1.run.app)

---

## 🌟 Key Features

### 1. HEIC Batch Converter
*   **100% Client-Side Transcoding**: Every transcode runs entirely within your browser context via standard WebAssembly-powered decoders (`heic2any`). Your photos, metadata details, and privacy never leave your local machine (zero-exposure guarantee).
*   **Electron Native 10-Bit & HDR Engine**: When run inside the desktop Electron shell, our custom IPC bridge is automatically used to run GPU-level high-bitrate conversion. It integrates macOS native `sips` command line tools or Node-level libde265 modules, bypassing the standard browser-based 8-bit memory constraints entirely.
*   **Intelligent Drop Zone**: Easily drag-and-drop files or click anywhere inside the drop area to select standard HEIC/HEIF graphics from local directories.
*   **Customizable Image Resizing**:
    *   **Fit (Ratio)**: Target width and height container boundary. Retains aspect ratio safely without distorting the layout.
    *   **Stretch (Exact)**: Forces the output to specific precise target pixels.
*   **Compression Tuning**: Direct output Jpeg quality adjustments via sliding scale parameters.
*   **Robust Multi-Frame Resolution**: Successfully bypasses typical single-frame canvas errors by automatically falling back to multi-frame/burst parsing (handles Depth/Portrait HEICs).
*   **Convenient Exports**: Download your transcoded files single-handedly, pack them all into a single structured `.ZIP` archive, or feed them directly to the integrated Timelapse Workspace.

### 2. Timelapse Studio Workspace
*   **Timeline Preview Board**: Stagger frames, adjust play speed in real-time (from 1 FPS up to 60 FPS), or toggle smooth visual slide durations.
*   **Dynamic Interactive Player**: Controls to preview, play, pause, or slide across any point in the storyboard.

---

## ⚙️ Development & Packaging

This utility is structured to build and run seamlessly as a modern browser applet, also featuring ready-to-run configurations for desktop packaging through **Electron**.

### Available NPM Scripts

Inside the project directory, you can run the following terminal commands:

#### Development
```bash
# Starts development environment (Vite transpilation)
npm run dev

# Starts the local development environment inside an active Electron frame desktop shell
npm run electron:start
```

#### Verification & Visual Checking
```bash
# Runs TypeScript types checking
npm run lint

# Compiles application files for production deployment
npm run build
```

#### Packaging Desktop App
To compile the production code and bundle everything cleanly inside a native desktop installer framework configuration:
```bash
# Packs production code into local binary distributions inside the absolute workspace directory
npm run package
```
> **Note**: This scripts resolves to `npm run build && electron-builder`.

---

## 💡 Recommended Troubleshooting (HDR / High-bit depth files)
Standard WebAssembly HEIC decoders natively decode standard **8-bit HEIC files**. Full High Dynamic Range captures (**10-bit HDR / ProRAW HDR / HDR10+**) are not supported directly in web browsers. 

If some files fail during batch transcoding:
*   **Samsung Galaxy Users**: Go to *Camera Settings* ➔ *Advanced picture options* ➔ Toggle off **"HDR10+ pictures / High bit-depth HEIF"**.
*   **iPhone / iOS Users**: Go to *Settings* ➔ *Camera* ➔ *Formats* ➔ select **"Most Compatible"** (to capture directly in universal JPEG format) or turn off ProRAW options.
*   **Alternatively**: Convert heavy high-bitrate captures using native OS programs (e.g. *Preview* on macOS, or *Photos* on Windows) before feeding them into browser tools.
