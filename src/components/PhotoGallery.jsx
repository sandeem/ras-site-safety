// Shows a submission's photos. The bucket is private, so we first ask Supabase
// for signed (temporary) links, then display them.

import { useEffect, useState } from 'react'
import { getPhotoUrls } from '../lib/api.js'
import { Alert, Loading } from './ui.jsx'

export default function PhotoGallery({ photos }) {
  const [urls, setUrls] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getPhotoUrls(photos.map((p) => p.storage_path))
      .then((result) => !ignore && setUrls(result))
      .catch(() => !ignore && setError('Could not load the photos.'))
    return () => {
      ignore = true
    }
  }, [photos])

  if (photos.length === 0) return <p className="muted">No photos attached.</p>
  if (error) return <Alert type="error">{error}</Alert>
  if (!urls) return <Loading label="Loading photos..." />

  return (
    <div className="gallery">
      {photos.map((photo) => (
        // Tap a photo to open the full-size image in a new tab.
        <a key={photo.id} href={urls[photo.storage_path]} target="_blank" rel="noreferrer">
          <img src={urls[photo.storage_path]} alt={photo.file_name} loading="lazy" />
        </a>
      ))}
    </div>
  )
}
