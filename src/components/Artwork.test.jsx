import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Artwork } from './Artwork';

afterEach(cleanup);

describe('Artwork', () => {
  it('renders an image for a valid source', () => {
    render(<Artwork src="https://cdn.example/cover.jpg" alt="封面" />);
    const image = screen.getByRole('img', { name: '封面' });
    expect(image).toBeInTheDocument();
  });

  it('falls back to the placeholder icon when the image fails to load', () => {
    render(<Artwork src="https://cdn.example/broken.jpg" alt="封面" />);
    fireEvent.error(screen.getByRole('img', { name: '封面' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('.artwork-empty')).toBeInTheDocument();
  });

  it('renders the placeholder icon when no source is given', () => {
    render(<Artwork alt="" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('.artwork-empty')).toBeInTheDocument();
  });
});
