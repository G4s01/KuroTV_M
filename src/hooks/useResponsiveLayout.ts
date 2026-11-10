import { useWindowDimensions } from 'react-native';

export interface CardDimensionsOptions {
  paddingHorizontal?: number;
  gap?: number;
  minCardWidth?: number;
  maxColumns?: number;
}

export interface ResponsiveLayout {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  railWidth: number;
  contentWidth: number;
  numColumns: number;
  cardWidth: number;
  cardHeight: number;
  isMasterDetail: boolean;
  leftMasterWidth: number;
  rightDetailWidth: number;
  episodeColumns: number;
  getCardDimensions: (options?: CardDimensionsOptions) => {
    numColumns: number;
    cardWidth: number;
    cardHeight: number;
  };
}

/**
 * Responsive layout hook for Kuro Mobile / Tablet
 * Enforces Android `sw600dp` standard for true tablets and foldables.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  // True tablet / foldable qualification (Android sw600dp equivalent)
  // Ensures standard phones rotated in landscape remain in phone layout.
  const isTablet = Math.min(width, height) >= 600;
  const isLandscape = width > height;

  const railWidth = isTablet ? 76 : 0;
  const contentWidth = Math.max(0, width - railWidth);

  const getCardDimensions = (options?: CardDimensionsOptions) => {
    const padding = options?.paddingHorizontal ?? 16;
    const gap = options?.gap ?? 12;
    const minWidth = options?.minCardWidth ?? 165;
    const maxCols = options?.maxColumns ?? (isTablet ? 6 : 2);

    let cols = 2;
    if (isTablet) {
      cols = Math.max(3, Math.min(maxCols, Math.floor(contentWidth / minWidth)));
    }

    const totalPadding = padding * 2;
    const totalGaps = gap * (cols - 1);
    const cardW = Math.floor((contentWidth - totalPadding - totalGaps) / cols);
    const cardH = Math.floor(cardW * 1.45);

    return {
      numColumns: cols,
      cardWidth: cardW,
      cardHeight: cardH,
    };
  };

  const defaultCards = getCardDimensions();

  // Master-Detail sizing for AnimeDetailScreen on tablets
  const isMasterDetail = isTablet;
  const leftMasterWidth = isTablet
    ? Math.min(380, Math.max(300, Math.floor(contentWidth * 0.36)))
    : contentWidth;
  const rightDetailWidth = isTablet
    ? Math.max(0, contentWidth - leftMasterWidth - 24)
    : contentWidth;

  const episodeColumns = isTablet
    ? Math.max(4, Math.min(8, Math.floor(rightDetailWidth / 72)))
    : 4;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    railWidth,
    contentWidth,
    numColumns: defaultCards.numColumns,
    cardWidth: defaultCards.cardWidth,
    cardHeight: defaultCards.cardHeight,
    isMasterDetail,
    leftMasterWidth,
    rightDetailWidth,
    episodeColumns,
    getCardDimensions,
  };
}
