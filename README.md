# Smart Apartment Car Parking Management System (SmartPark)

A modern, full-stack intelligent parking management and indoor navigation system designed for residential complexes and apartment campuses. The application integrates entrance camera simulation, Automatic Number Plate Recognition (ANPR / OCR), dynamic 48-bay slot allocation across 4 blocks, and A*/Dijkstra shortest-path navigation with turn-by-turn walking instructions from the Watchman Room.

---

## 1. Project Overview

Finding vacant parking bays and guiding visitors or residents to their allocated slots in multi-block apartment complexes can be challenging. The **Smart Apartment Car Parking Management System (SmartPark)** solves this problem by automating vehicle entry, license plate reading, intelligent slot allocation, and turn-by-turn indoor route visualization.

### Key Objectives
* Automatically detect vehicles entering the apartment campus via gate cameras.
* Extract vehicle license plates using optical character recognition (OCR / ANPR).
* Maintain real-time occupancy status across all 48 parking bays (Blocks A, B, C, D).
* Store comprehensive vehicle logs (Vehicle Number, Owner Name, Flat, Block, Slot, Entry Time, Exit Time, Status).
* Equip the watchman / security guard with instant search, interactive campus map visualization, and shortest-path walking navigation from the **Watchman Room** to any parking bay.
* Provide an interactive, one-click simulation console tailored for college project demonstrations and lab presentations.

---

## 2. Problem Statement

Modern apartment societies face significant parking management hurdles:
1. **Manual Entry Logging**: Security guards manually write down vehicle numbers in physical registers, causing gate congestion and errors.
2. **Unauthorized Parking & Misallocation**: Vehicles park in unassigned or reserved resident bays, leading to disputes.
3. **Complex Navigation**: Visitors and delivery drivers struggle to locate specific blocks and assigned parking bays in multi-level/multi-block layouts.
4. **Lack of Real-Time Visibility**: Guards have no instant visibility into total occupied vs. empty bays or EV-charging bays.

---

## 3. Proposed Solution

**SmartPark** provides a comprehensive end-to-end digital solution:
* **Gate Automation**: Simulates an entrance ANPR camera pipeline that detects vehicles, locates the license plate ROI, runs OCR, repairs optical character confusions (e.g., `0`/`O`, `1`/`I`), and validates Indian license plate standards (`SS RR LL NNNN`).
* **Intelligent Bay Allocation**: Allocates the optimal free parking bay based on proximity to the entrance gate and vehicle type (Standard, EV, Visitor).
* **Interactive 2D Campus Map**: SVG-based vector layout rendering all 4 blocks (A, B, C, D), drive lanes, cross roads, main gate, and Watchman Room without losing quality or layout context.
* **Graph Pathfinding (A* & Dijkstra)**: Computes the exact shortest walking path from the Watchman Room to the destination slot, providing distance in meters, estimated walking time, and step-by-step turn instructions.
* **Watchman Control Room**: High-performance dashboard with instant search, filters (Today / This Week / This Month), manual override, and single-click vehicle exit logging.

---

## 4. System Architecture

```text
               +-------------------------------------------+
               |              ENTRANCE GATE                |
               |   ANPR Camera (Webcam / Upload / Sim)     |
               +-------------------------------------------+
                                     |
                                     v
               +-------------------------------------------+
               |             AI / ANPR ENGINE              |
               |  - Vehicle Detection & Class Identification|
               |  - License Plate ROI Localization         |
               |  - OCR Engine (Tesseract.js / Fallback)    |
               |  - Indian Plate Syntax Validator & Repair |
               +-------------------------------------------+
                                     |
                                     v
               +-------------------------------------------+
               |       SMARTPARK BACKEND (Node/Express)    |
               |  - Parking Service & Next-Slot Allocation |
               |  - A* / Dijkstra Graph Navigation Engine  |
               |  - Stats & Dashboard Analytics Service    |
               |  - JWT Authentication & Role Guard        |
               +-------------------------------------------+
                                /          \
                               /            \
                              v              v
      +-----------------------------+  +-------------------------------+
      |  DATABASE LAYER             |  | FRONTEND (React + Vite)       |
      |  - MongoDB (via Mongoose)   |  | - Modern Glassmorphic UI      |
      |  - Zero-Config JSON Store   |  | - Interactive SVG Campus Map  |
      |  - Auto-Seeding Demo Engine |  | - Live Route Simulation       |
      +-----------------------------+  | - Real-time Stats & Filters   |
                                       +-------------------------------+
```

---

## 5. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, CSS3 Custom Properties, React Router 6 | Responsive, glassmorphic UI, dynamic navigation & state |
| **Mapping & Graphics** | SVG Vector Canvas, Custom Pathfinding Renderer | Resolution-independent campus layout & animated route polylines |
| **Backend** | Node.js (>= 18), Express.js 5 | REST APIs, route graph solver, session management |
| **Database** | MongoDB + Mongoose / Built-in JSON Store | Persistent storage with zero-config auto-fallback |
| **Security** | JWT (jsonwebtoken), BCrypt.js | Token-based watchman authentication & password hashing |
| **AI / ANPR** | OpenCV Concept, Tesseract OCR Adapter, Rule-based Parser | License plate detection, OCR extraction & character repair |

---

## 6. Campus Layout & Parking Grid

The complex features **48 dedicated parking bays** partitioned into 4 distinct blocks:

```text
                                APARTMENT PARKING
                              =====================

               BLOCK A                                      BLOCK B
     ┌────────────────────────┐                   ┌────────────────────────┐
     │  A-01   A-02   A-03   │                   │  B-01   B-02   B-03   │
     │  A-04   A-05   A-06   │                   │  B-04   B-05   B-06   │
     │  A-07   A-08   A-09   │                   │  B-07   B-08   B-09   │
     │  A-10   A-11   A-12   │                   │  B-10   B-11   B-12   │
     └────────────────────────┘                   └────────────────────────┘
                 │                                            │
                 └──────────────────────┬─────────────────────┘
                                        │
                                        ▼
                            MAIN PARKING ROAD (NORTH-SOUTH)
                                        │
                 ┌──────────────────────┴─────────────────────┐
                 │                                            │
               BLOCK C                                      BLOCK D
     ┌────────────────────────┐                   ┌────────────────────────┐
     │  C-01   C-02   C-03   │                   │  D-01   D-02   D-03   │
     │  C-04   C-05   C-06   │                   │  D-04   D-05   D-06   │
     │  C-07   C-08   C-09   │                   │  D-07   D-08   D-09   │
     │  C-10   C-11   C-12   │                   │  D-10   D-11   D-12   │
     └────────────────────────┘                   └────────────────────────┘
                                        ▲
                                        │
                              [ WATCHMAN ROOM ]
```

Each bay carries:
* **Slot ID** (e.g. `A-12`, `B-07`, `C-03`, `D-09`)
* **Status** (`Empty` or `Occupied`)
* **Bay Classification** (`Standard`, `EV Charging`, `Visitor`)
* **Vehicle Number** (if occupied)

---

## 7. AI & ANPR Pipeline Workflow

When a vehicle arrives at the gate, the 7-stage ANPR pipeline executes:

```text
1. CAMERA ACQUISITION       ->  Entrance camera stream / upload / simulation
            ↓
2. VEHICLE DETECTION        ->  Identifies vehicle class (Car, SUV, Hatchback, EV)
            ↓
3. NUMBER PLATE LOCALIZATION->  Extracts Region of Interest (ROI) containing plate
            ↓
4. OCR CHARACTER RECOGNITION->  Raw text recognition (e.g., "KAO1AB1234")
            ↓
5. SYNTAX REPAIR & CHECK    ->  Fixes confusions (O->0, I->1) => "KA01AB1234"
            ↓
6. SLOT ALLOCATION          ->  Finds nearest optimal empty bay (e.g., "B-07")
            ↓
7. DATABASE TRANSACTION     ->  Saves vehicle record, marks slot Occupied, updates KPIs
```

---

## 8. Shortest Path Navigation Algorithm

The indoor navigation module models the apartment road network as a weighted graph with:
* **Nodes**: Key landmarks (`WATCHMAN_ROOM`, `MAIN_GATE`), road intersections (`ROAD_NORTH_1`, `ROAD_MAIN_CENTER`, `ROAD_SOUTH_1`), block entrances (`BLOCK_A_ENTRY`, `BLOCK_B_ENTRY`, etc.), and slot connection points.
* **Edges**: Measured road distances in real ground scale (meters).

### A* Pathfinding Implementation
* **Cost Function**: $f(n) = g(n) + h(n)$
  * $g(n)$: Exact path distance from the Watchman Room to node $n$.
  * $h(n)$: Euclidean distance heuristic from node $n$ to the destination slot coordinate.
* **Dijkstra Comparison**: The system also supports standard Dijkstra traversal to verify optimal path optimality.

### Turn-by-Turn Instruction Generator
Computes relative bearing angles between consecutive segments to generate human-readable instructions:
```text
1. Exit Watchman Room and enter the south road
2. Walk straight on South Cross Road for 25 m
3. Turn right onto Main Central Road and continue for 35 m
4. Turn left at Block A Entrance
5. Continue down Aisle 2 for 20 m
6. Bay A-12 is on your right
```

---

## 9. Database Schema Design

### Vehicle Model (`models/Vehicle.js`)
```json
{
  "vehicleNumber": "KA01AB1234",
  "ownerName": "Rahul Sharma",
  "ownerFlat": "A-1201",
  "ownerPhone": "+91 98450 11223",
  "vehicleType": "Car",
  "brand": "Honda City",
  "color": "Black",
  "blockId": "A",
  "blockName": "Block A",
  "slotId": "A-12",
  "entryTime": "2026-10-02T10:32:00.000Z",
  "exitTime": null,
  "status": "Parked",
  "source": "ANPR",
  "cameraId": "CAM-GATE-01",
  "ocrConfidence": 96
}
```

### Parking Slot Model (`models/ParkingSlot.js`)
```json
{
  "slotId": "A-12",
  "blockId": "A",
  "blockName": "Block A",
  "row": 3,
  "col": 2,
  "type": "standard",
  "status": "Occupied",
  "vehicleNumber": "KA01AB1234",
  "entryTime": "2026-10-02T10:32:00.000Z"
}
```

---

## 10. Installation and Setup

### Prerequisites
* **Node.js**: Version 18 or higher (`node -v`)
* **npm**: Version 9 or higher (`npm -v`)
* *(Optional)* **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas. If omitted, the application automatically uses the built-in resilient JSON store.

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(This installs root, backend, and frontend packages simultaneously.)*

### Step 2: Run Backend Tests
Verify all 39 unit, layout, ANPR, pathfinding, and API tests pass:
```bash
npm test
```

### Step 3: Start the Application
Run both the Express API and Vite React frontend with a single command:
```bash
npm run dev
```

* **Frontend UI**: [http://localhost:5175](http://localhost:5175)
* **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)
* **Default Credentials**:
  * Username: `watchman`
  * Password: `watch123`
  *(Admin credentials: `admin` / `admin123`)*

---

## 11. Step-by-Step College Demo Instructions

Follow this demo script during project evaluation:

1. **Sign In**:
   - Open `http://localhost:5175`.
   - Click the **Watchman** demo account chip and log in.

2. **Dashboard Overview**:
   - View live KPIs: Total Slots (`48`), Occupied (`31`), Available (`17`), Vehicles Today (`42`).
   - Observe block-wise occupancy meters for Blocks A, B, C, and D.

3. **Simulate Vehicle Entry (ANPR)**:
   - Click **“Simulate vehicle entry”** on the Dashboard or in the **ANPR Camera** console.
   - Watch the 7-stage live animation: Camera -> Vehicle Detection -> Plate Localization -> OCR -> Validation -> Slot Allocation (`B-07`) -> Saved to DB.
   - Observe the live KPI counts update automatically.

4. **Watchman Search**:
   - Navigate to **Vehicle Search** or use the dashboard quick-search.
   - Search for `KA01AB1234` or any seeded plate.
   - View the detailed vehicle card (Owner Name, Flat, Vehicle Model, Entry Time, Distance from Watchman Room).

5. **Indoor Navigation**:
   - Click **“Navigate”** on the vehicle card or open the **Navigation** tab.
   - Select destination bay (e.g. `A-12` or `B-07`).
   - Notice the complete parking map showing all 48 bays, with only the route from **Watchman Room** highlighted in neon cyan.
   - View the total distance (e.g., `85 m`), estimated walking time (`~1 min 10 sec`), and step-by-step instructions.
   - Click **“Start navigation”** to view real-time animated step-by-step guidance!

6. **Simulate Vehicle Exit**:
   - Click **“Simulate vehicle exit”** or **“Record exit”** on any occupied bay.
   - The slot status immediately changes back to **Empty** (green), and counts re-synchronize in real time.

7. **Review Vehicle History**:
   - Navigate to **Vehicle History** and test the **Today**, **This Week**, and **This Month** filters.

---

## 12. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Watchman / admin authentication |
| `GET` | `/api/dashboard/stats` | Live totals, occupancy rates, recent entries & exits |
| `GET` | `/api/parking/map` | Complete SVG layout, 48 slots, road segments & graph |
| `GET` | `/api/parking/slots` | List all slots with status and occupied vehicle numbers |
| `GET` | `/api/vehicles/search?q=:query` | Search by plate number, slot, block, or owner |
| `GET` | `/api/vehicles/history?range=today\|week\|month` | Filtered vehicle audit trail |
| `GET` | `/api/navigation/route?slot=:slotId&algorithm=astar` | Shortest path polyline, distance & steps |
| `POST` | `/api/camera/simulate-entry` | Executes full ANPR detection & slot reservation |
| `POST` | `/api/camera/simulate-exit` | Releases a parking bay & timestamps exit |
| `POST` | `/api/camera/ocr` | Image upload / webcam snapshot OCR parsing |

---

## 13. Future Improvements

* **Real CCTV RTSP Stream Integration**: Direct streaming from hardware IP cameras via WebRTC/RTSP.
* **Edge ANPR with YOLOv8 / TensorRT**: High-FPS license plate recognition on low-power edge devices (Raspberry Pi / Jetson).
* **Automated Overhead Bay Vision**: Overhead camera sensors detecting slot occupancy without gate dependency.
* **Resident Mobile Application**: Flutter / React Native resident app for reserving visitor slots and receiving gate arrival notifications.
* **QR-Based Visitor Pass**: Digital guest invitations with pre-allocated slots and automated gate barrier opening.
* **EV Smart Charging Management**: Queue scheduling and automated power cutoff when EV charging completes.
* **Emergency Vehicle Priority Routing**: Automated clear-path routing and barrier clearance for ambulances and fire engines.
* **Voice-Guided Turn-by-Turn Navigation**: Real-time audio prompts for security guards and visitors walking through large basements.
* **Multi-Building & Multi-Level Basements**: Hierarchical multi-floor campus graphs with elevator and ramp transitions.

---

## 14. License

This project is licensed under the MIT License - free to use for academic, college, and personal demonstration purposes.
