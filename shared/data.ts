import { Author, Book, Review } from './types';

// In-memory store — shared by all three API implementations.
// Data resets on server restart; there is no database.

export const authors: Author[] = [
  { id: '1', name: 'Frank Herbert',      bio: 'American sci-fi author best known for Dune.' },
  { id: '2', name: 'Ursula K. Le Guin', bio: 'Author known for nuanced science fiction and fantasy.' },
  { id: '3', name: 'Isaac Asimov',       bio: 'Prolific writer known for Foundation and the Three Laws of Robotics.' },
];

export const books: Book[] = [
  { id: '1', title: 'Dune',                       authorId: '1', publishedYear: 1965, genre: 'Science Fiction', description: 'Epic set on the desert planet Arrakis.' },
  { id: '2', title: 'Dune Messiah',               authorId: '1', publishedYear: 1969, genre: 'Science Fiction', description: 'Paul Atreides grapples with his messianic role.' },
  { id: '3', title: 'The Left Hand of Darkness',  authorId: '2', publishedYear: 1969, genre: 'Science Fiction', description: 'A human envoy visits a planet with no fixed gender.' },
  { id: '4', title: 'Foundation',                 authorId: '3', publishedYear: 1951, genre: 'Science Fiction', description: 'A mathematician predicts the fall of a galactic empire.' },
  { id: '5', title: 'I, Robot',                   authorId: '3', publishedYear: 1950, genre: 'Science Fiction', description: 'Stories about robots and the Three Laws.' },
];

export const reviews: Review[] = [
  { id: '1', bookId: '1', rating: 5, comment: 'A masterpiece of world-building.' },
  { id: '2', bookId: '1', rating: 4, comment: 'Dense but deeply rewarding.' },
  { id: '3', bookId: '3', rating: 5, comment: 'Thought-provoking and beautifully written.' },
  { id: '4', bookId: '4', rating: 5, comment: 'Asimov at his best.' },
  { id: '5', bookId: '5', rating: 4, comment: 'Classic robot stories, still relevant.' },
];
