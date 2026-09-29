<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StorePlayerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:100'],
            'whatsapp' => ['required', 'string', 'regex:/^08[0-9]{8,11}$/', 'unique:players,whatsapp'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi',
            'name.min' => 'Nama minimal 3 karakter',
            'name.max' => 'Nama maksimal 100 karakter',
            'whatsapp.required' => 'Nomor WhatsApp wajib diisi',
            'whatsapp.regex' => 'Format nomor WhatsApp tidak valid (contoh: 081234567890)',
            'whatsapp.unique' => 'Nomor WhatsApp sudah terdaftar',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('whatsapp')) {
            // Normalize: +62 / 62 prefix -> 0
            $wa = preg_replace('/[^0-9+]/', '', (string) $this->whatsapp);
            $wa = preg_replace('/^\+?62/', '0', $wa);
            $this->merge(['whatsapp' => $wa]);
        }

        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->name)]);
        }
    }

    protected function failedValidation(Validator $validator): void
    {
        $errors = $validator->errors();
        $code = $errors->has('whatsapp') && str_contains($errors->first('whatsapp'), 'sudah terdaftar')
            ? 'DUPLICATE_WHATSAPP'
            : 'VALIDATION_ERROR';

        throw new HttpResponseException(response()->json([
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $errors->first(),
                'errors' => $errors->toArray(),
            ],
        ], $code === 'DUPLICATE_WHATSAPP' ? 409 : 422));
    }
}
