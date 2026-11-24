import { TestBed } from '@angular/core/testing';
import { RecipeImageComponent } from './recipe-image.component';

describe('Recipe image', () => {
  it('shows an explicit empty state instead of an unrelated stock photograph', () => {
    const fixture = TestBed.createComponent(RecipeImageComponent);
    fixture.componentRef.setInput('title', 'Sopa de verduras');
    fixture.componentRef.setInput('category', 'Cena');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sin fotografía');
    expect(fixture.nativeElement.querySelector('[role=img]').getAttribute('aria-label')).toContain('Sopa de verduras');
  });
  it('shows the supplied photo, handles its failure and retries a changed URL', async () => {
    const fixture = TestBed.createComponent(RecipeImageComponent);
    fixture.componentRef.setInput('title', 'Pollo con arroz');
    fixture.componentRef.setInput('src', 'https://example.com/pollo.jpg');
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://example.com/pollo.jpg');
    image.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sin fotografía');
    fixture.componentRef.setInput('src', 'https://example.com/pollo-corregido.jpg');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toContain('pollo-corregido.jpg');
  });
});
