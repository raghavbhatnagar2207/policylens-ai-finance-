import React from 'react';

export default function Title({ title, text, action }) {
  return (
    <div className="title">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
