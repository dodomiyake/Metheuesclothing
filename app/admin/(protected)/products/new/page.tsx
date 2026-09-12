import { ProductForm } from '../product-form';

export default function NewProductPage() {
  return (
    <div style={{ padding: 'var(--mc-space-xl)' }}>
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
        New product
      </h1>
      <ProductForm />
    </div>
  );
}
