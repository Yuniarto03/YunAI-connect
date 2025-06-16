
export const documentationMarkdownContent: string = `
# MasYunAI Data Connectivity - Application Documentation

## 1. Introduction

MasYunAI Data Connectivity is an interactive data connectivity and visualization platform designed to empower users with AI-powered insights and a futuristic user interface. It allows users to process and visualize data from various sources, interact with an AI chatbot, and leverage generative AI for document analysis and image generation.

## 2. Core Features

### 2.1. Dashboard
-   **Overview**: Provides a central landing page with quick access to various application modules.
-   **Widgets**: Interactive cards for navigating to key features like "Import Data," "Visualize Insights," "AI Document Analysis," "AI Chat Assistant," "Data Profiling," "Interactive Table Summary," and "App Documentation."
-   **Theme-Aware**: Adapts to the selected application theme.

### 2.2. Import Data
-   **Local File Upload**: Supports importing data from local \`.xls\`, \`.xlsx\`, and \`.json\` files.
-   **Cloud Source Connection**: Allows fetching data from online storage via a direct URL (e.g., publicly accessible Google Sheet, OneDrive, Dropbox link, or any direct file URL).
    - Supports \`.xlsx\`, \`.xls\`, and \`.json\` files from URLs.
    - Requires publicly accessible URLs with permissive CORS settings.
-   **Sheet Selection**: For Excel files with multiple sheets, users can select which sheet to load.
-   **File Processing**: Parses data into a tabular format, identifies headers, and makes it available for other modules.
-   **Feedback**: Provides messages for successful loading, errors, or empty files/sheets.
-   **Refresh Data**: Option to re-process the last loaded local file.

### 2.3. Data Table
-   **Data Display**: Shows loaded data in a paginated, sortable, and filterable table.
-   **Search**: Global search across all columns in the current view.
-   **Column Filtering**:
    -   Dropdown per column header to select unique values for filtering.
    -   Shows counts of values within the current filter context.
-   **Pagination**: Controls for navigating through large datasets (10, 25, 50, 100 rows per page).
-   **Table Preferences**:
    -   **Font Family**: Choose from System Default, Monospace, Serif, Inter UI, Verdana.
    -   **Font Size**: Select from Tiny (10px) to Large (18px).
    -   **Table Theme**: Apply various pre-designed themes (Default Dark, Ocean Blue, Matrix Table, Sunset Glow, Light Mode, High Contrast, Minimalist Dark).
-   **Save to Library**: Allows saving the currently processed dataset (including its name and any sheet information) to the local File Library for later use.

### 2.4. Data Profiling (Data Summary Page)
-   **Dataset Overview**: Displays general information about the loaded dataset (file name, sheet name, original rows, rows for stats after advanced filters, total columns).
-   **Advanced Data Filters**:
    -   Up to three cascading filter slots.
    -   Select a header and then a value for that header. Subsequent filter slots are dependent on previous selections.
    -   Allows users to profile specific subsets of their data.
    -   Option to clear all advanced filters.
-   **Column Selection Filter**:
    -   Show/hide individual columns from the summary view.
    -   Select/Unselect all columns.
-   **Column Statistics**: For each selected column (and based on advanced filters):
    -   **Name**: Column header.
    -   **Type**: Detected data type (numeric, string, boolean, mixed, empty).
    -   **Total Rows**: Number of rows in the current filtered selection.
    -   **Missing Values**: Count and percentage of missing/empty values.
    -   **Unique Values**: Count of distinct values.
    -   **Numeric Stats (for numeric columns)**: Min, Max, Mean, Median, Standard Deviation, Sum.
    -   **Categorical Stats (for string, mixed, boolean columns)**: Top 5 most frequent and least frequent values with their counts.
-   **Zoom View**: Modal to view detailed statistics for a single column with larger text.

### 2.5. Table Summary (Pivot Table)
-   **Interactive Pivot Configuration**:
    -   **Available Fields**: Lists all headers from the loaded dataset, with a search filter.
    -   **Drag-and-Drop Interface**: Drag fields from "Available Fields" to Rows, Columns, Values, or Filters (Pre-Summary) areas.
    -   **Rows Area**: Define row dimensions for the pivot table.
    -   **Columns Area**: Define column dimensions.
    -   **Values Area**: Define measures for aggregation.
        -   Select aggregation type per value field (Sum, Count, Average, Min, Max, Unique Count, StdDev, Count Non-Empty).
    -   **Filters Area (Pre-Summary)**: Apply filters to the source data *before* pivot calculation.
        -   Select values for each filter field.
        -   Option to hide/show this filter configuration section.
-   **Pivot Table Display**:
    -   Renders a dynamic pivot grid based on the configuration.
    -   Hierarchical row and column headers.
    -   Aggregated data cells.
-   **Layouts**:
    -   Dropdown to select predefined pivot layouts (e.g., "Sales by Region & Category"). Includes examples for sales, product quantity, and customer count.
    -   "Clear Layout" option to reset rows, columns, values, and filters.
-   **Options (Settings)**:
    -   Toggle display of Row/Column Grand Totals.
    -   Toggle display of Row/Column Subtotals.
    -   Set default collapse state for Row/Column Subtotals upon generation.
-   **Expand/Collapse**:
    -   Individually expand or collapse parent row/column headers.
    -   "Collapse All" and "Expand All" buttons for quick navigation of hierarchy levels.
-   **Actions**:
    -   **Refresh**: Recalculate the pivot table with the current configuration.
    -   **Export to Excel**: Download the current pivot table view as an \`.xlsx\` file.
-   **View Controls**:
    -   Maximize/Restore grid view (opens in a full-screen modal).
    -   Collapse/Expand grid view within the page.
    -   Close grid output.
-   **Chart Generation**:
    -   Button to generate a chart based on the current pivot table view.
    -   Opens a modal with a ComposedChart (Bar, Line, Area).
    -   Option to select chart type for the pivot-derived chart.

### 2.6. Data Visualization
-   **Chart Creation**: Add multiple chart configurations.
-   **Chart Types**: Supports Bar, Line, Area, Pie, Donut, and Scatter plots.
-   **Configuration per Chart**:
    -   **X-Axis (Group By)**: Select a header for the X-axis.
    -   **Y-Axis (Value)**: Select a header for the Y-axis.
    -   **Aggregation**: Choose how to aggregate Y-axis values (Sum, Count, Average, Min, Max, etc.).
    -   **Color**: Automatically assigned from a theme-derived palette.
    -   **Secondary Y-Axis**:
        -   Option to add a secondary Y-axis with its own key, chart type (Line, Bar, Area), and aggregation.
    -   **Data Filters (Chart Specific)**:
        -   Up to two filter pairs, each with a main header/value and an optional sub-header/sub-value.
        -   Filters apply only to the data for that specific chart.
-   **Chart Rendering**:
    -   Displays charts using Recharts library.
    -   Responsive containers.
    -   Tooltips with detailed information (including primary, secondary, and gap values for dual-axis charts).
    -   Legends.
    -   Custom styling for axes, grids, and labels based on the application theme.
    -   Value labels on bars/lines/areas for smaller datasets.
-   **Actions per Chart**:
    -   **Generate Chart**: Renders the chart based on the current configuration.
    -   **Reset Chart**: Clears the rendered chart, keeping the configuration.
    -   **Remove Chart**: Deletes the chart configuration.
-   **Zoom View**: Click a button on a generated chart to open it in a full-screen modal for better visibility.

### 2.7. AI Document Analysis
-   **Instruction Input**: Text area for users to provide instructions to the AI (e.g., "Summarize this document," "Extract all names and addresses," "Generate an image of a futuristic city based on this description").
-   **File Upload (Optional)**:
    -   Supports images (\`.jpeg\`, \`.png\`, etc.), \`.pdf\`, \`.docx\`, \`.xlsx\`, \`.xls\`, \`.pptx\`.
    -   The AI processes the instruction in conjunction with the uploaded file content.
-   **Output Type Selection**:
    -   **Text**: For summaries, Q&A, general text generation.
    -   **Data Table (JSON)**: If expecting structured data extraction (AI attempts to return JSON array of objects).
        - If successful, the extracted table is automatically loaded into the "Data Table" page for viewing and further analysis.
    -   **Image**: For image generation requests (uses Imagen model).
-   **AI Processing**:
    -   Sends the instruction and file (if any) to the Gemini API.
    -   Handles different MIME types for file processing.
-   **Output Display**:
    -   **Text**: Displays the AI's text response.
    -   **Image**: Displays the generated image (Base64 encoded PNG).
    -   **Table**: If data is extracted as a table, it informs the user and loads it into the Data Table view.
    -   **Error**: Shows any errors from the AI or processing.

### 2.8. File Library
-   **Local Storage**: Saves and lists datasets that users have explicitly saved from the "Data Table" page.
-   **File Information**: Displays file name, sheet name (if applicable), number of rows and columns, file size, and saved date/time for each entry.
-   **Actions**:
    -   **Load**: Loads the selected dataset back into the application, making it the active \`processedData\` for all modules. Navigates to the Data Table page.
    -   **Delete**: Removes the dataset from the library (with a confirmation prompt).

### 2.9. Documentation (This Page)
-   **Overview**: Provides comprehensive information about the application's features, functionalities, and usage.
-   **Download Options**:
    -   **Download as HTML**: Allows users to download the documentation in HTML format, which can be opened and viewed in web browsers or imported into word processors like Microsoft Word.
    -   **Print to PDF**: Enables users to print the documentation or save it as a PDF file using their browser's print functionality. The page is styled for optimal print output.
-   **Up-to-Date Content**: The documentation content is maintained to reflect the latest application features and changes.

### 2.10. Settings
-   **Application Theme**:
    -   Select from various pre-designed themes (Cyber Neon, Matrix Core, Tech Sunset, Void Pulse, Galactic Dawn, Silver Tech, Pure Light, Pure Dark).
    -   **System Default**: A special option that dynamically switches between "Pure Light" and "Pure Dark" based on the user's operating system preference.
    -   Theme changes are applied instantly across the application.
-   **API Configuration (Informational)**:
    -   Displays the status of the Gemini API Key (Configured or Not Found).
    -   Clarifies that the API key must be set via \`process.env.API_KEY\` and cannot be changed within the app.
-   **Notification Preferences**:
    -   **Enable In-App Notifications**: Toggle to turn on/off general application notifications (e.g., for successful operations, errors). Default: Off.
-   **Export Settings**:
    -   **Default Export Format**: Dropdown to select the default file format for exports (e.g., from Data Table, Pivot Table). Options: Excel (.xlsx), CSV (.csv), JSON (.json). Default: Excel (.xlsx).
-   **Data Processing Defaults**:
    -   **Automatically Profile Data on Load**: Toggle to enable/disable automatic navigation or triggering of data profiling after new data is imported. Default: Off.
-   **Accessibility Options**:
    -   **Reduce Animations & Motion Effects**: Toggle to disable or minimize non-essential animations and motion effects throughout the application for users sensitive to motion. Default: Off.

### 2.11. AI Chatbot (MasYunAI)
-   **Interface**:
    -   Draggable and resizable chat window.
    -   Maximizable to full screen and restorable.
    -   Collapsible (UI minimize) to header and expandable.
    -   Closable.
-   **Conversational AI**:
    -   Powered by Gemini API.
    -   Responds to general knowledge questions.
-   **Data Context Awareness**:
    -   If data is loaded in the application, the chatbot automatically includes a summary of this data (file name, headers, row count, sample data) in the prompt to the AI, allowing for data-related questions.
-   **Google Search Integration**:
    -   Option to toggle "Use Google Search" for queries.
    -   If enabled, the AI can ground its responses in up-to-date information from the web.
    -   Displays sources (URLs and titles) for search-grounded responses.
-   **Chat History**:
    -   Displays the conversation history.
    -   Scrolls to the latest message automatically.
-   **Message Formatting**:
    -   User and AI messages are clearly distinguished.
    -   Supports Markdown rendering for AI responses (links, lists, code blocks).
-   **Actions**:
    -   **Send Message**: Input field for typing messages.
    -   **Clear Chat**: Resets the chat history and conversation state.
    -   **Loading Indicator**: Shows when the AI is processing a response.
    -   **Streaming Responses**: AI responses are streamed token by token for a more interactive feel.

### 2.12. General User Interface & Experience
-   **Sidebar Navigation**: Collapsible sidebar with icons and names for all main application modules. Shortcut \`CTRL+B\` to toggle.
-   **Responsive Design**: Aims for usability across different screen sizes, though primarily desktop-focused.
-   **Theming**: Consistent application of selected themes across all components.
-   **Clock**: Draggable digital clock displaying current time and date, positioned in the main content area.
-   **Loading States & Feedback**: Visual cues for loading, success, and error messages.
-   **Accessibility**: Uses ARIA attributes and semantic HTML where appropriate. Includes options like "Reduce Motion."
-   **Offline Functionality**: Data loaded and configurations (like themes, saved files, general settings) are persisted in \`localStorage\` for offline access to previously loaded data and settings. API-dependent features (AI Chat, AI Document Analysis) require an internet connection and API key.

## 3. How to Use

*(This section would typically detail step-by-step guides for common workflows. For brevity in this generation, high-level steps are implied by feature descriptions.)*

1.  **Start by Importing Data**: Use the "Import Data" page to load a dataset.
2.  **Explore in Data Table**: View, search, and filter your data. Customize table appearance.
3.  **Profile Your Data**: Go to "Data Summary" to understand column characteristics and apply advanced filters for deeper dives.
4.  **Summarize with Pivot Table**: Use "Table Summary" to create dynamic cross-tabulations.
5.  **Visualize**: Create charts in "Data Visualization" to find trends and patterns.
6.  **Leverage AI**:
    -   Use "AI Document Analysis" for insights from uploaded files or text instructions.
    -   Engage with "MasYunAI Chatbot" for questions or data-specific queries.
7.  **Manage Files**: Save important datasets to the "File Library" and load them later.
8.  **Consult Documentation**: Refer to the "Documentation" page for detailed feature explanations.
9.  **Customize**: Adjust "Settings" to change the application theme and other preferences.

## 4. Technical Notes
-   **Frontend**: React, TypeScript, Tailwind CSS.
-   **AI Integration**: Google Gemini API via \`@google/genai\` SDK.
-   **Charting**: Recharts library.
-   **Data Handling**: Client-side processing for most data operations.
-   **API Key**: Must be provided as an environment variable (\`process.env.API_KEY\`). The application does not handle API key input or storage beyond reading it from the environment.

## 5. Future Enhancements (Potential)
-   More data source connectors.
-   Advanced chart customization options.
-   User accounts and cloud-based storage/collaboration.
-   More sophisticated AI-driven data preparation and insight generation features.
-   Direct export of visualizations.
-   Granular notification controls.

---
*This documentation will be updated as new features are added or existing ones are modified.*
`;
