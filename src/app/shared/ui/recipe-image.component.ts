import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'ns-recipe-image',
  standalone: true,
  template: `
    @if (src() && failedSource() !== src()) {
      <img [src]="src()" [alt]="title()" loading="lazy" decoding="async" (error)="failedSource.set(src())" />
    } @else {
      <div class="empty-photo" role="img" [attr.aria-label]="title() + ': sin fotografía'">
        <span aria-hidden="true">{{ category() }}</span>
        <small>Sin fotografía</small>
      </div>
    }
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; }
    img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .empty-photo { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; background: #edf5f3; color: #315b57; }
    .empty-photo span { font-size: 1.2rem; font-weight: 600; }
    .empty-photo small { font-size: .85rem; }
  `,
})
export class RecipeImageComponent {
  src = input<string | null | undefined>();
  title = input.required<string>();
  category = input('Receta');
  failedSource = signal<string | null | undefined>(undefined);
}
