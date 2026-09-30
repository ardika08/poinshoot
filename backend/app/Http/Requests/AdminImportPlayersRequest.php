<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Import banyak siswa sekaligus dari tempelan Excel / unggahan file.
 *
 * Dua sumber data, salah satu wajib ada:
 * - `text`  : hasil Ctrl+C dari Excel / Google Sheets
 * - `file`  : berkas .xlsx, .csv, atau .txt
 *
 * `rombel` opsional. Kalau diisi, dipakai untuk baris yang tidak menyebut
 * rombel-nya sendiri (mis. daftar satu kolom nama). Kalau data sudah memuat
 * kolom rombel, isi per baris itulah yang menang — jadi satu file bisa
 * sekaligus memuat beberapa rombel.
 *
 * `dry_run=true` hanya melaporkan hasil pembacaan tanpa menulis ke database,
 * supaya operator bisa memeriksa dulu sebelum menyimpan.
 */
class AdminImportPlayersRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Akses sudah dijaga middleware `admin` di routes/api.php
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required_without:text', 'nullable', 'file', 'max:5120'],
            'text' => ['required_without:file', 'nullable', 'string', 'max:200000'],
            'rombel' => ['nullable', 'string', 'regex:/^[1-6][AB]$/'],
            'dry_run' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required_without' => 'Unggah file atau tempel daftar nama dulu',
            'file.file' => 'Berkas tidak terbaca, coba unggah ulang',
            'file.max' => 'Ukuran file maksimal 5 MB',
            'text.required_without' => 'Tempel daftar nama atau unggah file dulu',
            'text.max' => 'Daftar terlalu panjang, maksimal sekitar 200.000 karakter',
            'rombel.regex' => 'Format rombel harus seperti 4A atau 4B',
        ];
    }

    /**
     * Bentuk error seragam dengan endpoint lain: { success, error: { code, message, errors } }
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'error' => [
                'code' => 'VALIDATION_ERROR',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->toArray(),
            ],
        ], 422));
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('rombel')) {
            $this->merge([
                'rombel' => strtoupper(trim((string) $this->input('rombel'))),
            ]);
        }

        // Kiriman multipart mengirim dry_run sebagai teks ("true"/"false"),
        // sedangkan rule `boolean` hanya menerima 1/0/true/false asli.
        if ($this->has('dry_run')) {
            $this->merge([
                'dry_run' => filter_var($this->input('dry_run'), FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }
}
