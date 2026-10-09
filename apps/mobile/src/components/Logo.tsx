import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

/** The FaceOff mark — F (blue) and O (red) bubbles across the ink divider. */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size * (120 / 88)} height={size} viewBox="0 0 120 88" accessibilityLabel="FaceOff">
      <Path d="M8 18c0-6.6 5.4-12 12-12h22c6.6 0 12 5.4 12 12v26c0 6.6-5.4 12-12 12h-2l12 18-26-18H20c-6.6 0-12-5.4-12-12z" fill="#6498AD" />
      <Path d="M66 18c0-6.6 5.4-12 12-12h22c6.6 0 12 5.4 12 12v26c0 6.6-5.4 12-12 12H80L54 74l12-18z" fill="#E5504A" />
      <SvgText x="31" y="47" textAnchor="middle" fontWeight="800" fontSize="34" fill="#0B1419" fontFamily="SourceSerif4_700Bold">F</SvgText>
      <SvgText x="89" y="47" textAnchor="middle" fontWeight="800" fontSize="34" fill="#0B1419" fontFamily="SourceSerif4_700Bold">O</SvgText>
      <Rect x="58.5" y="12" width="3" height="66" rx="1.5" fill="#0B1419" />
      <Circle cx="60" cy="5" r="4.5" fill="#0B1419" />
    </Svg>
  );
}
