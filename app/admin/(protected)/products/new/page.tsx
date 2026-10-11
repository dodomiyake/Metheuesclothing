import { ProductForm } from '../product-form';
import { WideOnly } from '@/components/admin/wide-only';

export default function NewProductPage() {
  return (
    <WideOnly title="New T-shirt">
      <div style={{ padding: 'var(--mc-space-xl)' }}>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
          New product
        </h1>
        <ProductForm />
      </div>
    </WideOnly>
  );
}
