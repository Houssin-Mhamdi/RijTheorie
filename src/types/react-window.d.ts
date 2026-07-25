declare module "react-window" {
  import { ComponentType, CSSProperties, Ref } from "react"

  interface ListChildComponentProps {
    index: number
    style: CSSProperties
  }

  interface ListProps {
    children?: ComponentType<ListChildComponentProps>
    className?: string
    defaultHeight?: number
    height: number | string
    itemCount: number
    itemSize: number
    listRef?: Ref<List>
    onItemsRendered?: (props: {
      overscanStartIndex: number
      overscanStopIndex: number
      visibleStartIndex: number
      visibleStopIndex: number
    }) => void
    overscanCount?: number
    style?: CSSProperties
    width: number | string
  }

  class List extends React.Component<ListProps> {
    scrollToItem(index: number, align?: string): void
  }

  export { List, List as FixedSizeList }
}
