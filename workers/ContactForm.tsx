'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');

    const formData = new FormData(e.currentTarget);
    formData.append('access_key', process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY!);
    formData.append('subject', 'New Contact: techguruofficial.us');
    formData.append('redirect', 'https://techguruofficial.us/contact/thanks'); // optional
    formData.append('botcheck', ''); // anti-spam honeypot

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData, // use FormData, not JSON, for file support & simplicity
        headers: { Accept: 'application/json' }
      });
      const result = await res.json();
      
      if (result.success) {
        setStatus('success');
        e.currentTarget.reset();
      } else {
        setStatus('error');
        console.error(result);
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="botcheck" className="hidden" />
      
      <div>
        <label htmlFor="name">Name *</label>
        <input id="name" name="name" type="text" required 
          className="w-full px-3 py-2 border rounded" />
      </div>
      
      <div>
        <label htmlFor="email">Email *</label>
        <input id="email" name="email" type="email" required 
          className="w-full px-3 py-2 border rounded" />
      </div>
      
      <div>
        <label htmlFor="message">Message *</label>
        <textarea id="message" name="message" required rows={4}
          className="w-full px-3 py-2 border rounded" />
      </div>
      
      <button type="submit" disabled={status === 'submitting'}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {status === 'submitting' ? 'Sending...' : 'Send Message'}
      </button>
      
      {status === 'success' && <p className="text-green-600">Message sent ✓</p>}
      {status === 'error' && <p className="text-red-600">Failed. Try again.</p>}
    </form>
  );
}