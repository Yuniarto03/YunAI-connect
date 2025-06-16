import { Theme, DataRow } from './types';
import { RAW_COLOR_VALUES } from './constants';

/**
 * Generates base class names and styles for themed select elements.
 * @param theme The current application theme.
 * @param customFontSize Optional custom Tailwind font size class (e.g., 'text-xs').
 * @returns An object containing baseClassName, style object, and optionStyle object.
 */
export const getSharedSelectBaseStyles = (theme: Theme, customFontSize?: string): { baseClassName: string; style: React.CSSProperties; optionStyle: React.CSSProperties } => {
  const textColor = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
  const borderColor = RAW_COLOR_VALUES[theme.borderColor.replace('border-','')] || RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';
  const bgColor = RAW_COLOR_VALUES[theme.darkGray] || '#1E293B';
  const accentColorHex = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF'; // Raw hex for focus ring

  // SVG for dropdown arrow, colorized with theme's text color
  const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${textColor.replace('#', '%23')}"><path d="M7 10l5 5 5-5H7z"/></svg>`;
  const arrowBg = `url("data:image/svg+xml;charset=UTF-8,${arrowSvg}")`;

  const fontSizeClass = customFontSize || 'text-sm'; // Default to text-sm if not provided

  return {
    baseClassName: `border rounded-md ${fontSizeClass} focus:outline-none focus:ring-1 focus:ring-[${accentColorHex}] focus:border-[${accentColorHex}] transition-colors appearance-none bg-no-repeat`,
    style: {
      backgroundColor: bgColor,
      color: textColor,
      borderColor: borderColor,
      backgroundImage: arrowBg,
      backgroundPosition: `right 0.5rem center`, // Default position
      backgroundSize: `1.25em 1.25em`,           // Default size
      paddingRight: '2.5rem',                  // Default padding for arrow
    },
    optionStyle: { // Styles for <option> elements
      backgroundColor: bgColor,
      color: textColor,
    },
  };
};

/**
 * Checks if a field in the dataset is predominantly numeric.
 * @param fieldName The name of the field (column header) to check.
 * @param data The dataset (array of DataRow objects).
 * @returns True if the field is considered numeric, false otherwise.
 */
export const isNumericDataField = (fieldName: string, data: DataRow[] | undefined): boolean => {
    if (!data || data.length === 0 || !fieldName) return false;
    let nonNullSampleCount = 0;
    let numericCount = 0;
    // Check a sample of rows (e.g., up to 100 non-null values)
    for (let i = 0; i < data.length && nonNullSampleCount < 100; i++) {
        const value = data[i][fieldName];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
            nonNullSampleCount++;
            // Check if the value can be parsed as a float and is finite
            if (!isNaN(parseFloat(String(value))) && isFinite(Number(value))) {
                numericCount++;
            }
        }
    }
    // Consider numeric if a high percentage (e.g., >80%) of non-null samples are numeric
    return nonNullSampleCount > 0 && (numericCount / nonNullSampleCount) > 0.8;
};
