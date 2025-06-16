import React, { useState, useCallback, useContext, useRef } from 'react';
import { useDropzone, FileWithPath } from 'react-dropzone';
import * as XLSX from 'xlsx'; 
import { AppContext } from '../contexts/AppContext';
import { AppContextType, AiDocumentResponse, DataRow, Theme, AiOutputTypeHint, CombinedAiOutput, AiServiceResponseType, PptxJsonData, PptxSlideData, PptxLayoutType, PptxSlideElement } from '../types';
import { analyzeDocumentWithGemini, parseJsonResponse } from '../services/geminiService';
import Button from './shared/Button';
import LoadingSpinner from './shared/LoadingSpinner';
import { UploadCloud, FileText, Brain, AlertTriangle, Image as ImageIcon, Table2, ChevronDown, ChevronUp, Download as DownloadIcon, FileSpreadsheet, Type, PictureInPicture, FileJson, FileArchive, Presentation } from 'lucide-react'; // Changed FilePresentation to Presentation
import DataTableComponent from './DataTable'; 
import { RAW_COLOR_VALUES } from '../constants';
import { exportTableToExcel, exportTableToCSV, exportTableToJson } from '../services/DataProcessingService';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { marked } from 'marked';
import { getSharedSelectBaseStyles } from '../utils'; // Import shared utility

const AiDocument: React.FC = () => {
  const { theme, setProcessedData, reduceMotion, apiKey } = useContext(AppContext) as AppContextType;
  const [instruction, setInstruction] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileWithPath | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<AiDocumentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputTypeHint, setOutputTypeHint] = useState<AiOutputTypeHint>('text');
  const [isInputConfigMinimized, setIsInputConfigMinimized] = useState<boolean>(false);


  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    setError(null);
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!instruction.trim()) {
      setError("Please provide an instruction for the AI.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAiResponse(null);

    let finalInstruction = instruction;
    let fileToSendToService: File | undefined = selectedFile || undefined;

    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      try {
        const reader = new FileReader();
        const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as ArrayBuffer);
          reader.onerror = (error) => reject(error);
          reader.readAsArrayBuffer(selectedFile);
        });
        
        const workbook = XLSX.read(fileData, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("The Excel file contains no sheets.");
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        
        const excelContentString = JSON.stringify(jsonData, null, 2);
        const MAX_EXCEL_CONTENT_LENGTH = 15000; 
        let truncatedNotice = "";
        let contentToSend = excelContentString;

        if (excelContentString.length > MAX_EXCEL_CONTENT_LENGTH) {
          contentToSend = excelContentString.substring(0, MAX_EXCEL_CONTENT_LENGTH) + "\n... (content truncated due to length)";
          truncatedNotice = " (Note: Excel content was truncated due to its length. Analysis will be based on the initial part of the data.)";
        }
        
        finalInstruction = `The user uploaded an Excel file named '${selectedFile.name}'. Its content (from the first sheet, '${firstSheetName}'${truncatedNotice}) is provided below in JSON format. Please use this data to respond to the user's instruction.

Excel Content (JSON from first sheet):
\`\`\`json
${contentToSend}
\`\`\`

User's original instruction:
${instruction}`;
        
        fileToSendToService = undefined; 

      } catch (excelError: any) {
        console.error("Error processing Excel file:", excelError);
        setError(`Failed to process Excel file: ${excelError.message}. Please ensure it's a valid Excel file.`);
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await analyzeDocumentWithGemini(finalInstruction, fileToSendToService, outputTypeHint);
      setAiResponse({...response, originalUserHint: outputTypeHint}); 
      if (response.type === 'error') {
        setError(response.content as string);
      } else if ((response.type === 'table' || (response.type === 'combined' && (response.content as CombinedAiOutput).tablePart)) && response.content) {
          const tableData = response.type === 'table' ? response.content as DataRow[] : (response.content as CombinedAiOutput).tablePart;
          if (tableData && tableData.length > 0) {
              const headers = Object.keys(tableData[0]);
              setProcessedData({
                  fileName: response.fileName || `ai_generated_data_${Date.now()}.json`,
                  data: tableData,
                  headers: headers,
              }, { isUserAction: false });
          } else if (response.type === 'table') { 
              setProcessedData(null, { isUserAction: false }); 
          }
      }
    } catch (e: any) {
      console.error("Error in AI Document Analysis:", e);
      setError(e.message || "An unexpected error occurred.");
      setAiResponse({ type: 'error', content: e.message, originalUserHint: outputTypeHint });
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadTextFile = (textContent: string, baseFileName: string, format: 'txt' | 'md') => {
    const fileExtension = format === 'txt' ? '.txt' : '.md';
    const mimeType = format === 'txt' ? 'text/plain' : 'text/markdown';
    const finalFileName = (baseFileName.endsWith(fileExtension) ? baseFileName : baseFileName.replace(/\.[^/.]+$/, "") + fileExtension);

    const blob = new Blob([textContent], { type: `${mimeType};charset=utf-8` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadTable = (tableContent: DataRow[], baseFileName: string, format: 'xlsx' | 'json' | 'csv') => {
    let finalFileName = baseFileName.replace(/\.[^/.]+$/, ""); // Remove existing extension

    switch (format) {
      case 'xlsx':
        exportTableToExcel(tableContent, `${finalFileName}.xlsx`);
        break;
      case 'json':
        exportTableToJson(tableContent, `${finalFileName}.json`);
        break;
      case 'csv':
        exportTableToCSV(tableContent, `${finalFileName}.csv`);
        break;
    }
  };

  const downloadImage = (base64Content: string, baseFileName: string) => {
    const finalFileName = baseFileName.endsWith('.png') ? baseFileName : `${baseFileName.replace(/\.[^/.]+$/, "")}.png`;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Content}`;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDocx = async (markdownContent: string, baseFileName: string) => {
    setIsLoading(true);
    try {
      const htmlContent = await marked.parse(markdownContent);
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + htmlContent + footer;

      const blob = new Blob([sourceHTML], { type: 'application/msword' });
      const finalFileName = `${baseFileName.replace(/\.[^/.]+$/, "")}.docx`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error("Error generating DOCX:", e);
      setError("Failed to generate DOCX. Check console for details.");
      downloadTextFile(markdownContent, baseFileName, 'md'); // Fallback to MD
    }
    setIsLoading(false);
  };

  const downloadPdf = async (markdownContent: string, baseFileName: string) => {
    setIsLoading(true);
    try {
      const pdf = new jsPDF();
      const htmlContent = await marked.parse(markdownContent);
      // jsPDF's html method is basic. For complex layouts, more advanced handling or a different library might be needed.
      // This might require the html2canvas library as well for better rendering if not already bundled or if complex HTML.
      // For simpler Markdown, converting to basic text lines might be more reliable if HTML rendering is poor.
      await pdf.html(htmlContent, {
        callback: function (doc) {
          doc.save(`${baseFileName.replace(/\.[^/.]+$/, "")}.pdf`);
        },
        x: 10,
        y: 10,
        width: 180, // A4 width in mm approx
        windowWidth: 650 // virtual window width
      });
    } catch (e) {
      console.error("Error generating PDF:", e);
      setError("Failed to generate PDF. Check console for details.");
      downloadTextFile(markdownContent, baseFileName, 'md'); // Fallback to MD
    }
    setIsLoading(false);
  };
  
  const downloadPptx = async (jsonDataString: string, baseFileName: string, originalInstruction: string) => {
    setIsLoading(true);
    try {
      const parsedData = parseJsonResponse(jsonDataString) as PptxJsonData;
      if (!parsedData || !parsedData.slides || !Array.isArray(parsedData.slides)) {
        throw new Error("Invalid JSON structure for PPTX slides. Expected { theme?: {...}, slides: [{...}] }.");
      }

      const pptx = new PptxGenJS();

      // Apply global theme from AI or app
      let presTitle = parsedData.theme?.title || baseFileName.replace(/\.[^/.]+$/, "") || "AI Generated Presentation";
      pptx.author = parsedData.theme?.author || (apiKey ? 'MasYunAI' : 'AI Assistant');
      pptx.company = parsedData.theme?.company || 'User Generated Content';
      pptx.title = presTitle;
      pptx.subject = originalInstruction.substring(0, 100);


      // Define default styles based on app theme, overridden by AI theme
      const appThemePrimaryColor = (RAW_COLOR_VALUES[theme.accent1] || '0078D4').replace('#', '');
      const appThemeSecondaryColor = (RAW_COLOR_VALUES[theme.accent2] || '4A4A4A').replace('#', '');
      const appThemeTextColor = (RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '333333').replace('#', '');

      const finalTheme = {
        primaryColor: (parsedData.theme?.primaryColor?.replace('#', '') || appThemePrimaryColor),
        secondaryColor: (parsedData.theme?.secondaryColor?.replace('#', '') || appThemeSecondaryColor),
        bodyTextColor: (parsedData.theme?.bodyTextColor?.replace('#', '') || appThemeTextColor),
        fontFamily: parsedData.theme?.fontFamily || 'Arial',
      };
      
      // Define Master Slides using PptxGenJS's defineSlideMaster
      // These names will be used by `layout` property from AI.
      pptx.defineSlideMaster({
        title: 'TITLE_SLIDE',
        background: { color: finalTheme.primaryColor, transparency: 85 },
        objects: [
          { rect: { x: 0, y: 0, w: '100%', h: 0.75, fill: { color: finalTheme.primaryColor } } },
          { text: {
              text: 'Title Placeholder',
              options: { placeholder: 'title', x: 0.5, y: 2.0, w: '90%', h: 1.5, fontSize: 44, bold: true, color: 'FFFFFF', align: 'center', fontFace: finalTheme.fontFamily }
            }
          },
          { text: {
              text: 'Subtitle Placeholder',
              options: { placeholder: 'subtitle', x: 0.5, y: 3.75, w: '90%', h: 0.75, fontSize: 24, color: finalTheme.primaryColor, align: 'center', fontFace: finalTheme.fontFamily }
            }
          },
        ],
      });

      pptx.defineSlideMaster({
        title: 'TITLE_AND_CONTENT',
        background: { color: 'F2F2F2' },
        objects: [
          { rect: { x: 0, y: 0, w: '100%', h: 0.75, fill: { color: finalTheme.primaryColor } } },
          { text: {
              text: 'Title Placeholder',
              options: { placeholder: 'title', x: 0.5, y:0.1, w: '90%', h:0.6, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: finalTheme.fontFamily }
            }
          },
          { text: {
              text: 'Body Placeholder',
              options: { placeholder: 'body', x: 0.5, y: 1.0, w: '90%', h: '75%', fontSize: 18, color: finalTheme.bodyTextColor, fontFace: finalTheme.fontFamily }
            }
          },
        ],
      });
       pptx.defineSlideMaster({
        title: 'SECTION_HEADER',
        background: { color: finalTheme.secondaryColor, transparency: 70 },
        objects: [
          { text: {
              text: 'Section Title Placeholder',
              options: { placeholder: 'title', x: 0.5, y: 2.5, w: '90%', h: 1.0, fontSize: 36, bold: true, color: finalTheme.primaryColor, align: 'center', fontFace: finalTheme.fontFamily } }
          },
           { text: {
              text: 'Section Subtitle Placeholder',
              options: { placeholder: 'subtitle', x: 0.5, y: 3.5, w: '90%', h: 0.5, fontSize: 18, color: finalTheme.bodyTextColor, align: 'center', fontFace: finalTheme.fontFamily } }
          },
        ],
      });


      parsedData.slides.forEach((slideData: PptxSlideData) => {
        const slideLayout = slideData.layout || 'TITLE_AND_CONTENT';
        const slide = pptx.addSlide({ masterName: slideLayout });

        if (slideData.backgroundColor) {
            slide.background = { color: slideData.backgroundColor.replace('#','') };
        }

        // If top-level title/subtitle are provided and elements don't override them for specific placeholders.
        if (slideData.title && !slideData.elements?.some(el => el.type === 'title')) {
          slide.addText(slideData.title, { placeholder: 'title' });
        }
        if (slideData.subtitle && !slideData.elements?.some(el => el.type === 'subtitle')) {
          slide.addText(slideData.subtitle, { placeholder: 'subtitle' });
        }

        // Process elements
        if (slideData.elements && slideData.elements.length > 0) {
          let bodyContent: PptxGenJS.TextProps[] = [];
          slideData.elements.forEach(el => {
            const elOptions: PptxGenJS.TextPropsOptions = {
                fontFace: finalTheme.fontFamily,
                color: finalTheme.bodyTextColor,
                fontSize: 18, // Default body font size
                ...(el.options || {}), // AI provided options take precedence
            };
            if (el.options?.color && !el.options.color.startsWith('#')) elOptions.color = el.options.color;


            if (el.type === 'title') {
              slide.addText(el.text || '', { placeholder: 'title', ...elOptions, fontSize: elOptions.fontSize || 32, bold: elOptions.bold === undefined ? true : elOptions.bold });
            } else if (el.type === 'subtitle') {
              slide.addText(el.text || '', { placeholder: 'subtitle', ...elOptions, fontSize: elOptions.fontSize || 24 });
            } else if (el.type === 'paragraph') {
              bodyContent.push({ text: el.text || '', options: { ...elOptions, breakLine: true } });
            } else if (el.type === 'bulletList' && el.items) {
              el.items.forEach(item => bodyContent.push({ text: item, options: { ...elOptions, bullet: true, indentLevel: el.options?.indentLevel } }));
               bodyContent.push({ text: '', options: { breakLine: true } }); // Add space after list
            } else if (el.type === 'imagePlaceholder' && el.text) {
              // Add a text placeholder for the image prompt
              bodyContent.push({ text: `[AI Suggestion: Image of "${el.text}"]`, options: { ...elOptions, italic: true, color: finalTheme.secondaryColor, fontSize: elOptions.fontSize || 14, breakLine: true } });
            }
          });
          
          if (bodyContent.length > 0) {
            try {
                 slide.addText(bodyContent, { placeholder: 'body' });
            } catch (e) { // Placeholder not found or other error
                console.warn(`Body placeholder not found for layout ${slideLayout}, adding content directly.`);
                // Fallback positioning if 'body' placeholder is not found
                slide.addText(bodyContent, { x: 0.5, y: 1.0, w: '90%' }); // Removed h: 'auto'
            }
          }
        }
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      });

      await pptx.writeFile({ fileName: `${baseFileName.replace(/\.[^/.]+$/, "")}.pptx` });
    } catch (e: any) {
      console.error("Error generating PPTX:", e);
      setError(`Failed to generate PPTX: ${e.message}. Ensure AI output is valid JSON for slides. Falling back to text download of the JSON data.`);
      downloadTextFile(jsonDataString, baseFileName, 'txt'); // Fallback to TXT for the raw JSON data
    }
    setIsLoading(false);
  };


  const outputTypeOptions: {value: AiOutputTypeHint, label: string, icon?: React.ElementType}[] = [
    { value: 'text', label: "Teks (.txt)", icon: Type },
    { value: 'msword', label: "MS Word (.docx)", icon: FileText },
    { value: 'pdf', label: "PDF (.pdf)", icon: FileText },
    { value: 'pptx', label: "PPT (.pptx)", icon: Presentation }, // Changed icon
    { value: 'json', label: "JSON (untuk data tabel)", icon: FileJson },
    { value: 'xlsx', label: "Excel (.xlsx, untuk data tabel)", icon: FileSpreadsheet },
    { value: 'png', label: "Gambar (.png)", icon: ImageIcon },
    { value: 'combined_text_table_image', label: "Gabungan (Teks, Tabel, Gambar)", icon: FileArchive },
  ];


  const selectStyles = getSharedSelectBaseStyles(theme); 
  const animationClass = reduceMotion ? '' : 'animate-fade-in';
  const baseDownloadFileName = aiResponse?.fileName?.replace(/\.[^/.]+$/, "") || 'ai_output';


  return (
    <div className={`p-8 ${theme.textColor} futuristic-scrollbar overflow-auto h-full`}>
      <h1 className={`text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Analisis Dokumen AI</h1>

      <div className={`grid grid-cols-1 gap-8`}>
        {/* Input Section */}
        <div className={`${theme.cardBg} rounded-xl shadow-xl border ${theme.borderColor}`}>
          <div className="flex justify-between items-center p-4 border-b ${theme.borderColor}">
            <h2 className={`text-2xl font-semibold text-${theme.accent3}`}>Konfigurasi Input</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsInputConfigMinimized(!isInputConfigMinimized)}
              className={`p-1.5 hover:bg-${theme.mediumGray}/30`}
              aria-label={isInputConfigMinimized ? "Expand Input Configuration" : "Minimize Input Configuration"}
            >
              {isInputConfigMinimized ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </Button>
          </div>
          
          {!isInputConfigMinimized && (
            <div className={`p-6 ${animationClass}`}>
              <div className="mb-4">
                <label htmlFor="instruction" className="block text-sm font-medium mb-1">Instruksi AI:</label>
                <textarea
                  id="instruction"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Contoh: Ringkas dokumen ini, ekstrak entitas kunci, atau hasilkan gambar kota futuristik berdasarkan deskripsi ini."
                  rows={4}
                  className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-${theme.accent1} focus:border-${theme.accent1} transition-colors futuristic-scrollbar`}
                  style={{
                    backgroundColor: RAW_COLOR_VALUES[theme.darkGray],
                    color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')],
                    borderColor: RAW_COLOR_VALUES[theme.mediumGray],
                    '--placeholder-color': `${RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || '#E0E0E0'}80` 
                  } as React.CSSProperties}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Unggah Dokumen (Opsional):</label>
                <div
                  {...getRootProps()}
                  className={`
                    p-6 border-2 border-dashed rounded-lg cursor-pointer
                    transition-all duration-300 ease-in-out text-center
                    ${theme.borderColor} hover:border-${theme.accent1} hover:bg-${theme.accent1}/10
                    ${isDragActive ? `border-${theme.accent1} bg-${theme.accent1}/20 shadow-neon-glow-${theme.accent1}/50` : ''}
                  `}
                >
                  <input {...getInputProps()} />
                  <UploadCloud size={36} className={`mx-auto mb-2 ${isDragActive ? `text-${theme.accent1}` : theme.textColor.replace('text-','')}`} />
                  {isDragActive ? (
                    <p className={`text-md font-semibold text-${theme.accent1}`}>Letakkan file di sini ...</p>
                  ) : (
                    <p className="text-md">Seret & lepas file, atau klik untuk memilih</p>
                  )}
                </div>
                {selectedFile && (
                  <div className={`mt-3 flex items-center space-x-2 p-2 bg-${theme.mediumGray}/50 rounded-md`}>
                    <FileText size={20} className={`text-${theme.accent1}`} />
                    <span className="text-sm">{selectedFile.name}</span>
                    <button 
                      onClick={() => setSelectedFile(null)} 
                      className={`ml-auto text-xs text-${theme.accent4} hover:text-${theme.accent4}/80`}
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <label htmlFor="outputType" className="block text-sm font-medium mb-1">Jenis Output yang Diinginkan (Petunjuk Generasi AI):</label>
                <select
                  id="outputType"
                  value={outputTypeHint}
                  onChange={(e) => setOutputTypeHint(e.target.value as AiOutputTypeHint)}
                  className={`${selectStyles.baseClassName} w-full p-2`}
                  style={selectStyles.style}
                >
                  {outputTypeOptions.map(opt => (
                     <option key={opt.value} value={opt.value} style={selectStyles.optionStyle}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs opacity-60 mt-1">
                    Ini memandu AI tentang apa yang akan dihasilkan. Opsi unduhan mungkin bervariasi.
                </p>
              </div>

              <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading || !instruction.trim()} variant="primary" className="w-full" leftIcon={<Brain size={18}/>}>
                {isLoading ? 'Menganalisis...' : 'Proses dengan AI'}
              </Button>
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className={`${theme.cardBg} rounded-xl shadow-xl border ${theme.borderColor} flex flex-col`}>
          <div className="flex justify-between items-center p-4 border-b ${theme.borderColor}">
            <h2 className={`text-2xl font-semibold text-${theme.accent4}`}>Output AI</h2>
          </div>
          <div className={`p-6 flex-grow ${animationClass}`}>
            {isLoading && (
              <div className="flex-grow flex items-center justify-center min-h-[200px]">
                <LoadingSpinner text="AI sedang berpikir..." />
              </div>
            )}
            {error && !isLoading && (
              <div className={`my-4 p-4 rounded-lg bg-${theme.accent4}/20 border border-${theme.accent4} text-${theme.accent4} flex items-center gap-3`}>
                <AlertTriangle size={24} />
                <span>{error}</span>
              </div>
            )}
            {aiResponse && !isLoading && !error && (
              <div className="space-y-4">
                {/* Render content */}
                {aiResponse.type === 'text' && typeof aiResponse.content === 'string' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2"><Type size={20} className={`text-${theme.accent1}`} /><h3 className="text-lg font-medium">Respon AI:</h3></div>
                    <pre 
                        className={`whitespace-pre-wrap text-sm leading-relaxed p-3 rounded-md border max-h-[40vh] overflow-y-auto futuristic-scrollbar`}
                        style={{
                            backgroundColor: RAW_COLOR_VALUES[theme.darkGray] + 'BF', 
                            borderColor: RAW_COLOR_VALUES[theme.mediumGray],
                            color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')]
                        }}
                    >
                      {aiResponse.content}
                    </pre>
                  </div>
                )}
                {aiResponse.type === 'image' && typeof aiResponse.content === 'string' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2"><ImageIcon size={20} className={`text-${theme.accent1}`} /><h3 className="text-lg font-medium">Gambar yang Dihasilkan:</h3></div>
                    <img 
                      src={`data:image/png;base64,${aiResponse.content}`} 
                      alt={aiResponse.fileName || "Generated Image"} 
                      className={`max-w-full h-auto rounded-lg shadow-lg border ${theme.borderColor}`}
                    />
                  </div>
                )}
                {aiResponse.type === 'table' && Array.isArray(aiResponse.content) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2"><Table2 size={20} className={`text-${theme.accent1}`} /><h3 className="text-lg font-medium">Tabel yang Dihasilkan: {aiResponse.fileName || "Data AI"}</h3></div>
                    {aiResponse.content.length > 0 ? (
                        <div className="h-96 overflow-auto"> 
                            <DataTableComponent /> 
                        </div>
                    ) : (
                        <p>AI menghasilkan tabel kosong atau data non-tabular.</p>
                    )}
                  </div>
                )}
                {aiResponse.type === 'combined' && typeof aiResponse.content === 'object' && aiResponse.content !== null && (() => {
                    const combined = aiResponse.content as CombinedAiOutput;
                    return (
                        <>
                            {combined.textPart && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2"><Type size={20} className={`text-${theme.accent1}`} /><h3 className="text-lg font-medium">Analisis Teks:</h3></div>
                                    <pre className={`whitespace-pre-wrap text-sm leading-relaxed p-3 rounded-md border max-h-[30vh] overflow-y-auto futuristic-scrollbar`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray] + 'BF', borderColor: RAW_COLOR_VALUES[theme.mediumGray], color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')] }}>
                                        {combined.textPart}
                                    </pre>
                                </div>
                            )}
                            {combined.tablePart && combined.tablePart.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-2"><Table2 size={20} className={`text-${theme.accent2}`} /><h3 className="text-lg font-medium">Tabel yang Diekstrak:</h3></div>
                                    <div className="h-96 overflow-auto">
                                        <DataTableComponent />
                                    </div>
                                </div>
                            )}
                            {combined.imagePart && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-2"><ImageIcon size={20} className={`text-${theme.accent3}`} /><h3 className="text-lg font-medium">Gambar yang Dihasilkan:</h3></div>
                                    {combined.imageDescription && <p className="text-xs opacity-70 mb-1 italic">Berdasarkan deskripsi: "{combined.imageDescription}"</p>}
                                    <img 
                                        src={`data:image/png;base64,${combined.imagePart}`} 
                                        alt={combined.imageDescription || "Generated supplementary image"}
                                        className={`max-w-md h-auto rounded-lg shadow-lg border ${theme.borderColor}`}
                                    />
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* Download Section */}
                <div className="mt-6 pt-4 border-t ${theme.borderColor}">
                  <h4 className={`text-md font-semibold mb-3 text-${theme.accent4}`}>Opsi Unduh:</h4>
                  <div className="space-y-3">
                    {aiResponse.type === 'text' && typeof aiResponse.content === 'string' && (
                      <div className="flex flex-wrap gap-2">
                        {aiResponse.originalUserHint === 'msword' && <Button onClick={() => downloadDocx(aiResponse.content as string, baseDownloadFileName)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>MS Word (.docx)</Button>}
                        {aiResponse.originalUserHint === 'pdf' && <Button onClick={() => downloadPdf(aiResponse.content as string, baseDownloadFileName)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>PDF (.pdf)</Button>}
                        {aiResponse.originalUserHint === 'pptx' && <Button onClick={() => downloadPptx(aiResponse.content as string, baseDownloadFileName, instruction)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>PPT (.pptx)</Button>}
                        {(aiResponse.originalUserHint !== 'msword' && aiResponse.originalUserHint !== 'pdf' && aiResponse.originalUserHint !== 'pptx') && (
                           <>
                             <Button onClick={() => downloadTextFile(aiResponse.content as string, baseDownloadFileName, 'txt')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Teks (.txt)</Button>
                             <Button onClick={() => downloadTextFile(aiResponse.content as string, baseDownloadFileName, 'md')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Markdown (.md)</Button>
                           </>
                        )}
                      </div>
                    )}
                    {aiResponse.type === 'table' && Array.isArray(aiResponse.content) && aiResponse.content.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => downloadTable(aiResponse.content as DataRow[], baseDownloadFileName, 'xlsx')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Excel (.xlsx)</Button>
                        <Button onClick={() => downloadTable(aiResponse.content as DataRow[], baseDownloadFileName, 'json')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>JSON</Button>
                        <Button onClick={() => downloadTable(aiResponse.content as DataRow[], baseDownloadFileName, 'csv')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>CSV</Button>
                      </div>
                    )}
                    {aiResponse.type === 'image' && typeof aiResponse.content === 'string' && (
                      <Button onClick={() => downloadImage(aiResponse.content as string, baseDownloadFileName)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Gambar (.png)</Button>
                    )}
                    {aiResponse.type === 'combined' && typeof aiResponse.content === 'object' && aiResponse.content !== null && (() => {
                      const combined = aiResponse.content as CombinedAiOutput;
                      return (
                        <div className="space-y-3">
                          {combined.textPart && (
                            <div>
                              <p className="text-sm font-medium mb-1">Analisis Teks:</p>
                              <div className="flex flex-wrap gap-2">
                                {aiResponse.originalUserHint === 'msword' && <Button onClick={() => downloadDocx(combined.textPart!, `${baseDownloadFileName}_text`)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>MS Word (.docx)</Button>}
                                {aiResponse.originalUserHint === 'pdf' && <Button onClick={() => downloadPdf(combined.textPart!, `${baseDownloadFileName}_text`)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>PDF (.pdf)</Button>}
                                {aiResponse.originalUserHint === 'pptx' && <Button onClick={() => downloadPptx(combined.textPart!, `${baseDownloadFileName}_presentation`, instruction)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>PPT (.pptx)</Button>}
                                {(aiResponse.originalUserHint !== 'msword' && aiResponse.originalUserHint !== 'pdf' && aiResponse.originalUserHint !== 'pptx') && (
                                    <>
                                        <Button onClick={() => downloadTextFile(combined.textPart!, `${baseDownloadFileName}_text`, 'txt')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Teks (.txt)</Button>
                                        <Button onClick={() => downloadTextFile(combined.textPart!, `${baseDownloadFileName}_text`, 'md')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Markdown (.md)</Button>
                                    </>
                                )}
                              </div>
                            </div>
                          )}
                          {combined.tablePart && combined.tablePart.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-1">Data Tabel:</p>
                              <div className="flex flex-wrap gap-2">
                                <Button onClick={() => downloadTable(combined.tablePart!, `${baseDownloadFileName}_table`, 'xlsx')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Excel (.xlsx)</Button>
                                <Button onClick={() => downloadTable(combined.tablePart!, `${baseDownloadFileName}_table`, 'json')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>JSON</Button>
                                <Button onClick={() => downloadTable(combined.tablePart!, `${baseDownloadFileName}_table`, 'csv')} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>CSV</Button>
                              </div>
                            </div>
                          )}
                          {combined.imagePart && (
                            <div>
                              <p className="text-sm font-medium mb-1">Gambar:</p>
                              <Button onClick={() => downloadImage(combined.imagePart!, `${baseDownloadFileName}_image`)} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>}>Gambar (.png)</Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                     {/* Fallback for no downloadable content */}
                     {!(aiResponse.type === 'text' && typeof aiResponse.content === 'string') &&
                      !(aiResponse.type === 'table' && Array.isArray(aiResponse.content) && aiResponse.content.length > 0) &&
                      !(aiResponse.type === 'image' && typeof aiResponse.content === 'string') &&
                      !(aiResponse.type === 'combined' && typeof aiResponse.content === 'object' && aiResponse.content !== null && 
                        ((aiResponse.content as CombinedAiOutput).textPart || 
                         ((aiResponse.content as CombinedAiOutput).tablePart && (aiResponse.content as CombinedAiOutput).tablePart!.length > 0) || 
                         (aiResponse.content as CombinedAiOutput).imagePart)) &&
                      (
                         <p className="text-sm opacity-70">Tidak ada konten yang dapat diunduh untuk output AI saat ini.</p>
                      )
                    }
                  </div>
                </div>
              </div>
            )}
            {!aiResponse && !isLoading && !error && (
              <div className="flex-grow flex items-center justify-center text-center opacity-50 min-h-[200px]">
                <p>Output AI akan muncul di sini setelah diproses.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiDocument;
