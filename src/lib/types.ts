export type Kind = "expense" | "income";
export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: Kind;
  color: string;
  archived: boolean;
}
export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  opening_balance: number;
}
export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string;
  kind: Kind;
  amount: number;
  note: string;
  occurred_on: string;
  created_at: string;
}
export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  amount: number;
}
export interface Data {
  categories: Category[];
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: Budget[];
}
export type Table = keyof Data;
export type Row = Category | Wallet | Transaction | Budget;
export interface Mutation {
  id: string;
  table: Table;
  row: Row;
}
export const emptyData = (): Data => ({
  categories: [],
  wallets: [],
  transactions: [],
  budgets: [],
});
