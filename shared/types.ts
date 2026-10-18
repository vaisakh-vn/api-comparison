export interface Author {
  id: string;
  name: string;
  bio: string;
}

export interface Book {
  id: string;
  title: string;
  authorId: string;
  publishedYear: number;
  genre: string;
  description: string;
}

export interface Review {
  id: string;
  bookId: string;
  rating: number; // 1–5
  comment: string;
}
