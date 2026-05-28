import './PageLoader.css'

function SkeletonCard({ count = 1, lines = 3, className = '' }) {
  const cards = Array.from({ length: count }, (_, index) => index)

  return (
    <>
      {cards.map((index) => (
        <article className={`skeleton-card ${className}`} key={index} aria-hidden="true">
          <span className="skeleton-media" />
          <span className="skeleton-line wide" />
          {Array.from({ length: lines }, (_, lineIndex) => (
            <span className={`skeleton-line line-${lineIndex}`} key={lineIndex} />
          ))}
        </article>
      ))}
    </>
  )
}

export default SkeletonCard
