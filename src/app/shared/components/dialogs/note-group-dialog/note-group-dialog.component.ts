import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

export interface NoteGroupPayload {
  label: string;
  description: string;
}

@Component({
  selector: 'app-note-group-dialog',
  imports: [FontAwesomeModule, ReactiveFormsModule],
  templateUrl: './note-group-dialog.component.html',
  styleUrl: './note-group-dialog.component.scss',
})
export class NoteGroupDialogComponent {
  private readonly fb = inject(FormBuilder);

  @Input() saving = false;

  @Output() closeDialog = new EventEmitter<void>();
  @Output() createGroup = new EventEmitter<NoteGroupPayload>();

  readonly icons = {
    close: faXmark,
  };

  readonly form = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(255)]],
  });

  submit(): void {
    if (this.form.invalid || this.saving) {
      return;
    }

    const value = this.form.getRawValue();

    this.createGroup.emit({
      label: value.label ?? '',
      description: value.description ?? '',
    });
  }
}
