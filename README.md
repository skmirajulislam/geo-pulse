# World-Monitor (GeoPulse)

![World-Monitor Banner](https://geopulsefront.vercel.app/og-image.png) <!-- Update with actual banner if available -->

**Live Demo:** [https://geopulsefront.vercel.app/](https://geopulsefront.vercel.app/)

World-Monitor (GeoPulse) is an advanced, AI-powered geopolitical intelligence dashboard. It aggregates real-time global news, processes them through Large Language Models (LLMs like Google Gemini API) for sentiment and entity extraction, and provides comprehensive geographic and relationship visualization.

## 🌟 Key Features

*   **Real-Time Data Pipeline:** Automated cron jobs fetch and process news/conflict data continuously.
*   **AI-Powered Analysis:** Leverages Google Gemini and other LLMs to analyze geopolitical events, extract actors, determine sentiment, and score global impact.
*   **Interactive 3D Globe:** Visualizes physical locations of events using `react-globe.gl`.
*   **Entity Relationship Graph:** Dynamic network visualization of geopolitical actors, relationships, and events using D3.js force simulations.
*   **Historical Timeline:** Persistent historical timeline allowing users to explore past events.
*   **Real-time Updates:** WebSocket integration (`socket.io`) for instant feed updates.

## 🛠️ Technology Stack

### Frontend
*   **Framework:** React 19, React Router v7
*   **Styling:** Tailwind CSS, Radix UI primitives, Framer Motion
*   **Visualization:** `react-globe.gl`, `react-leaflet`, `d3-force`, `recharts`
*   **State & Networking:** Axios, Socket.io-client
*   **Build Tool:** Create React App (CRA) via Craco

### Backend
*   **Runtime:** Node.js, Express.js
*   **AI Integration:** `@google/generative-ai` (Gemini API), `openai`
*   **Database & Caching:** MongoDB, Redis (`ioredis`)
*   **Task Scheduling:** `node-cron`
*   **Real-Time:** Socket.io
*   **Security & Optimization:** Helmet, Express Rate Limit, Morgan

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
*   Node.js (v18+)
*   MongoDB Instance
*   Redis Instance
*   Google Gemini API Key (or other LLM API Keys)

### Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder based on your setup:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   REDIS_HOST=localhost
   REDIS_PORT=6379
   GEMINI_API_KEY=your_gemini_api_key
   # Add other relevant keys like OPENAI_API_KEY if needed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (using Yarn or npm):
   ```bash
   yarn install
   # or
   npm install
   ```
3. Create a `.env` file in the `frontend` folder:
   ```env
   REACT_APP_API_URL=http://localhost:5000
   ```
4. Start the development server:
   ```bash
   yarn dev
   # or
   npm run dev
   ```

## 🗺️ Roadmap / Future Plans
*   **Predictive Analysis:** Integrate advanced machine learning models to forecast potential geopolitical events and conflict escalations based on historical data patterns.
*   **Deep-Dive Analysis Reports:** Automated generation of comprehensive intelligence reports for specific regions or actors.
*   **Expanded Data Sources:** Incorporate more diverse data feeds including social media sentiment, economic indicators, and localized news outlets.
*   **User Customization:** Allow users to create customized dashboards tracking specific countries, themes, or actors.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
This project is licensed under the [ISC License](LICENSE).
