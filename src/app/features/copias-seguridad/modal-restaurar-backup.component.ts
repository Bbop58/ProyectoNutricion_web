import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService, BackupPreview } from '../../core/services/backup.service';
@Component({
  selector: 'app-modal-restaurar-backup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-restaurar-backup.component.html',
  styleUrls: ['./modal-restaurar-backup.component.css'],
})
export class ModalRestaurarBackupComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() restoreFile: File | null = null;
  @Input() tenantId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() restored = new EventEmitter<string>();
  isRestoring = signal(false);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  preview = signal<BackupPreview | null>(null);
  password = '';
  private revision = 0;
  private previouslyFocusedElement: HTMLElement | null = null;
  constructor(
    public backupService: BackupService,
    private readonly host: ElementRef<HTMLElement>,
  ) {}
  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['isOpen'];
    if (openChange?.currentValue && !openChange.previousValue) {
      this.previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => {
        if (this.isOpen) {
          this.host.nativeElement
            .querySelector<HTMLElement>('[data-dialog-initial-focus]')
            ?.focus();
        }
      });
    } else if (openChange?.previousValue && !openChange.currentValue) {
      this.restoreFocus();
    }

    this.password = '';
    this.preview.set(null);
    this.revision++;
    if (this.isOpen && this.restoreFile) this.analyze();
  }
  @HostListener('keydown', ['$event'])
  handleDialogKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrar();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = this.host.nativeElement.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!dialog || !focusable?.length) {
      event.preventDefault();
      dialog?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  analyze(): void {
    if (!this.restoreFile || !this.tenantId) {
      this.errorMessage.set('Selecciona la empresa antes de cargar el respaldo.');
      return;
    }
    const revision = ++this.revision;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.preview.set(null);
    this.backupService.previewBackup(this.restoreFile, this.tenantId).subscribe({
      next: (p) => {
        if (revision !== this.revision) return;
        this.preview.set(p);
        this.loading.set(false);
      },
      error: (e) => {
        if (revision !== this.revision) return;
        this.loading.set(false);
        this.errorMessage.set(e?.error?.detail || 'No se pudo analizar el archivo.');
      },
    });
  }
  confirmarRestauracion(): void {
    const review = this.preview();
    if (!this.restoreFile || !review || !this.password || !review.missing || this.isRestoring())
      return;
    this.isRestoring.set(true);
    this.errorMessage.set(null);
    this.backupService
      .restoreBackup(this.restoreFile, this.password, review.review_token, this.tenantId)
      .subscribe({
        next: (r) => {
          this.isRestoring.set(false);
          this.password = '';
          this.restored.emit(r.message);
          this.cerrar();
        },
        error: (e) => {
          this.isRestoring.set(false);
          this.password = '';
          this.errorMessage.set(
            e?.error?.detail || 'No se pudo restaurar. Vuelve a analizar el archivo.',
          );
        },
      });
  }
  cerrar(): void {
    if (this.isRestoring()) return;
    this.revision++;
    this.password = '';
    this.closed.emit();
    this.restoreFocus();
  }
  private restoreFocus(): void {
    if (this.previouslyFocusedElement?.isConnected) this.previouslyFocusedElement.focus();
    this.previouslyFocusedElement = null;
  }
}
