import React from 'react'

export function LogoWordmark({ small = false, align = 'center' }) {
  const sizeClass = small ? 'brand-wordmark--small' : 'brand-wordmark--large'
  const alignClass = align === 'left' ? 'brand-lockup--left' : 'brand-lockup--center'

  return (
    <div className={`brand-lockup ${alignClass}`}>
      <div className="brand-wordmark-row">
        <span className={`brand-wordmark ${sizeClass}`}>KAUVIO</span>
        <span className={`brand-swiss-cross ${small ? 'brand-swiss-cross--small' : ''}`} aria-hidden="true">
          <span className="brand-swiss-cross-vertical" />
          <span className="brand-swiss-cross-horizontal" />
        </span>
      </div>
      {!small ? <div className="brand-subline">Schweiz · AI Search</div> : null}
    </div>
  )
}
