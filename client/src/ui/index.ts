// The Zumpo design system: code components for the Figma file's Shared
// pieces. Import './zumpo.css' once at the app root.

export {
  Avatar,
  AVATAR_TONES,
  type AvatarProps,
  type AvatarTone,
} from './components/avatar';
export { Bid, type BidProps } from './components/bid';
export { BidPicker, type BidPickerProps } from './components/bid-picker';
export {
  Button,
  ButtonLink,
  type ButtonLinkProps,
  type ButtonProps,
  type ButtonVariant,
} from './components/button';
export { Card, type CardProps } from './components/card';
export { ChoiceList, type ChoiceListProps } from './components/choice-list';
export { Chat, type ChatProps } from './components/chat';
export {
  ChatInput,
  CHAT_MAX_LENGTH,
  type ChatInputProps,
} from './components/chat-input';
export {
  ChatMessage,
  type ChatMessageKind,
  type ChatMessageProps,
} from './components/chat-message';
export {
  Countdown,
  formatClock,
  URGENT_SECONDS,
  type CountdownProps,
} from './components/countdown';
export {
  Cup,
  type CupProps,
  type CupState,
} from './components/cup';
export {
  Die,
  type DieFace,
  type DieProps,
  type DieState,
} from './components/die';
export { Dialog, DialogClose, type DialogProps } from './components/dialog';
export {
  BRUSH_SIZES,
  DrawingToolbar,
  type BrushSize,
  type DrawingToolbarProps,
} from './components/drawing-toolbar';
export {
  Header,
  type HeaderLink,
  type HeaderMenu,
  type HeaderProps,
  type Viewer,
} from './components/header';
export { Icon, type GlyphName, type IconProps } from './components/icon';
export {
  MineCell,
  type MineCellProps,
  type MineCellState,
} from './components/mine-cell';
export {
  MobileTabs,
  type MobileTab,
  type MobileTabsProps,
} from './components/mobile-tabs';
export { Notice, type NoticeProps, type NoticeTone } from './components/notice';
export {
  NumberCard,
  type NumberCardProps,
  type NumberCardState,
} from './components/number-card';
export { OperatorKey, type OperatorKeyProps } from './components/operator-key';
export {
  PairsCard,
  type PairsCardProps,
  type PairsCardState,
} from './components/pairs-card';
export {
  PairsSymbol,
  symbolName,
  symbolNamed,
  type PairsSymbolProps,
  type SymbolName,
} from './components/pairs-symbol';
export {
  PickMarker,
  type PickMarkerProps,
  type PickOutcome,
} from './components/pick-marker';
export { PickResult, type PickResultProps } from './components/pick-result';
export {
  PlayerRow,
  type PlayerRowProps,
  type PlayerRowState,
} from './components/player-row';
export { RoomBar, type RoomBarProps } from './components/room-bar';
export {
  RoomRow,
  type RoomRowProps,
  type RoomRowStatus,
} from './components/room-row';
export { Scoreboard, type ScoreboardProps } from './components/scoreboard';
export {
  SelectField,
  type SelectFieldProps,
  type SelectOption,
} from './components/select-field';
export { StatList, type Stat } from './components/stat-list';
export { Tag, type TagProps, type TagTone } from './components/tag';
export { TextField, type TextFieldProps } from './components/text-field';
export {
  TurnBar,
  type TurnBarKind,
  type TurnBarProps,
} from './components/turn-bar';
export { WordChoice, type WordChoiceProps } from './components/word-choice';
export { Wordmark } from './components/wordmark';
export { brushes, type BrushName } from './generated/brushes';
