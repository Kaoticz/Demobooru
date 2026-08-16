import { Link } from 'react-router-dom';

import type { BoardImage } from '../api/types';
import SafeImage from './SafeImage';

export default function ImageCard({ image }: { image: BoardImage }) {
  return (
    <Link
      to={`/images/${image.id}`}
      className="card"
      title={`${image.original_filename} — ${image.tags.join(' ')}`}
    >
      <SafeImage src={image.url} alt={image.original_filename} className="card__img" />
    </Link>
  );
}
