export type BlockType =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'todo'
  | 'quote'
  | 'divider'
  | 'code';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

export interface Page {
  id: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  blocks: Block[];
}
