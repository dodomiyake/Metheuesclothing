'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

type ProductFormValues = {
  slug: string;
  name: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  description_short: string;
  design_story: string;
  fit: string;
  fabric_weight_gsm: string;
  composition: string;
  neck: string;
  made_in: string;
  care_instructions: string;
  packed_weight_g: string;
  hs_code: string;
  country_of_origin: string;
  seo_title: string;
  seo_description: string;
};

const EMPTY: ProductFormValues = {
  slug: '',
  name: '',
  status: 'draft',
  description_short: '',
  design_story: '',
  fit: '',
  fabric_weight_gsm: '',
  composition: '',
  neck: '',
  made_in: '',
  care_instructions: '',
  packed_weight_g: '',
  hs_code: '',
  country_of_origin: '',
  seo_title: '',
  seo_description: '',
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ProductForm({
  productId,
  initial,
}: {
  productId?: string;
  initial?: Partial<ProductFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY, ...initial });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // null clears a field that was previously set; omitting it (undefined)
    // would be dropped by JSON.stringify and leave the old value in place on
    // an edit -- see the note on ProductFields in lib/admin/product-schema.ts.
    const payload = {
      slug: values.slug,
      name: values.name,
      status: values.status,
      description_short: values.description_short || null,
      design_story: values.design_story || null,
      fit: values.fit || null,
      fabric_weight_gsm: values.fabric_weight_gsm ? Number(values.fabric_weight_gsm) : null,
      composition: values.composition || null,
      neck: values.neck || null,
      made_in: values.made_in || null,
      care_instructions: values.care_instructions || null,
      packed_weight_g: values.packed_weight_g ? Number(values.packed_weight_g) : null,
      hs_code: values.hs_code || null,
      country_of_origin: values.country_of_origin || null,
      seo_title: values.seo_title || null,
      seo_description: values.seo_description || null,
    };

    const res = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
      method: productId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong. Please try again.');
      return;
    }

    const body = await res.json();
    router.push(`/admin/products/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'var(--mc-font-body)', maxWidth: 720 }}>
      {error && (
        <p role="alert" style={{ color: 'var(--mc-status-error)' }}>
          {error}
        </p>
      )}

      <Section title="Basic information">
        <Field label="Name">
          <input
            required
            value={values.name}
            onChange={(e) => {
              const name = e.target.value;
              set('name', name);
              if (!slugTouched) set('slug', slugify(name));
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="Slug">
          <input
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="Status">
          <select
            value={values.status}
            onChange={(e) => set('status', e.target.value as ProductFormValues['status'])}
            style={inputStyle}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </Section>

      <Section title="Description and story">
        <Field label="Short description">
          <textarea
            value={values.description_short}
            onChange={(e) => set('description_short', e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
          />
        </Field>
        <Field label="Design story">
          <textarea
            value={values.design_story}
            onChange={(e) => set('design_story', e.target.value)}
            style={{ ...inputStyle, minHeight: 120 }}
          />
        </Field>
      </Section>

      <Section title="Fit and garment spec">
        <p style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)', marginTop: 0 }}>
          The size guide reads from these fields, so they are the one place to change a
          measurement or a fit description.
        </p>
        <Field label="Fit">
          <input value={values.fit} onChange={(e) => set('fit', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Fabric weight (gsm)">
          <input
            type="number"
            min={1}
            value={values.fabric_weight_gsm}
            onChange={(e) => set('fabric_weight_gsm', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Composition">
          <input
            value={values.composition}
            onChange={(e) => set('composition', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Neck">
          <input value={values.neck} onChange={(e) => set('neck', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Made in">
          <input
            value={values.made_in}
            onChange={(e) => set('made_in', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Care instructions">
          <textarea
            value={values.care_instructions}
            onChange={(e) => set('care_instructions', e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
          />
        </Field>
      </Section>

      <Section title="Delivery data">
        <Field label="Packed weight (g)">
          <input
            type="number"
            min={1}
            value={values.packed_weight_g}
            onChange={(e) => set('packed_weight_g', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="HS code">
          <input
            value={values.hs_code}
            onChange={(e) => set('hs_code', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Country of origin">
          <input
            value={values.country_of_origin}
            onChange={(e) => set('country_of_origin', e.target.value)}
            style={inputStyle}
          />
        </Field>
      </Section>

      <Section title="SEO">
        <Field label="SEO title">
          <input
            value={values.seo_title}
            onChange={(e) => set('seo_title', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="SEO description">
          <textarea
            value={values.seo_description}
            onChange={(e) => set('seo_description', e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
          />
        </Field>
      </Section>

      <button
        type="submit"
        disabled={saving}
        style={{
          minHeight: 44,
          padding: '0 var(--mc-space-xl)',
          background: 'var(--mc-action-primary-bg)',
          color: 'var(--mc-action-primary-text)',
          border: 'none',
          borderRadius: 'var(--mc-radius-sm)',
          fontFamily: 'var(--mc-font-body)',
          fontSize: 'var(--mc-type-body)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {saving ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset
      style={{
        border: 'none',
        borderTop: '1px solid var(--mc-border-default)',
        padding: 'var(--mc-space-lg) 0',
        margin: 0,
      }}
    >
      <legend
        style={{
          fontSize: 'var(--mc-type-label)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          padding: 0,
          marginBottom: 'var(--mc-space-md)',
        }}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--mc-space-md)' }}>
      <span
        style={{
          display: 'block',
          fontSize: 'var(--mc-type-caption)',
          color: 'var(--mc-text-muted)',
          marginBottom: 'var(--mc-space-2xs)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--mc-border-default)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  boxSizing: 'border-box',
};
