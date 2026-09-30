<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class UpdatePlayerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $playerId = $this->route('id');

        return [
            'name' => ['sometimes', 'required', 'string', 'min:3', 'max:100'],
            'rombel' => ['sometimes', 'required', 'string', 'regex:/^[1-6][A-Z]$/', 'max:10'],
            'whatsapp' => [
                'sometimes',
                'required',
                'string',
                'regex:/^08[0-9]{8,11}$/',
                Rule::unique('players', 'whatsapp')->ignore($playerId),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.min' => 'Nama minimal 3 karakter',
            'name.max' => 'Nama maksimal 100 karakter',
            'whatsapp.regex' => 'Format nomor WhatsApp tidak valid (contoh: 081234567890)',
            'whatsapp.unique' => 'Nomor WhatsApp sudah digunakan pemain lain',
            'rombel.regex' => 'Format rombel harus seperti 4A atau 4B',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('whatsapp')) {
            $wa = preg_replace('/[^0-9+]/', '', (string) $this->whatsapp);
            $wa = preg_replace('/^\+?62/', '0', $wa);
            $this->merge(['whatsapp' => $wa]);
        }

        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->name)]);
        }

        if ($this->has('rombel')) {
            $this->merge(['rombel' => strtoupper(trim((string) $this->rombel))]);
        }
    }

    protected function failedValidation(Validator $validator): void
    {
        $errors = $validator->errors();
        $code = $errors->has('whatsapp') && str_contains($errors->first('whatsapp'), 'sudah digunakan')
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
