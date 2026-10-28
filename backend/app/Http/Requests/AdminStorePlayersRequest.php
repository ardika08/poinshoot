<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Tambah siswa dari dashboard admin (bukan registrasi mandiri).
 *
 * Dipakai untuk menyiapkan daftar siswa sebelum acara supaya:
 * - guru bisa input skor manual lebih dulu (akun sudah ada),
 * - siswa di lapangan tinggal memilih namanya, tidak perlu mengetik.
 *
 * Nama yang tidak valid / sudah ada tidak menggagalkan seluruh permintaan —
 * dilaporkan di ringkasan supaya operator bisa koreksi tanpa mengulang semua.
 */
class AdminStorePlayersRequest extends FormRequest
{
    /**
     * Nilai khusus "rombel umum" — untuk peserta gelar karya / acara umum.
     * Disimpan sebagai `null` di kolom rombel (lihat AdminController),
     * sehingga otomatis masuk papan peringkat Umum, bukan papan sekolah.
     */
    public const ROMBEL_UMUM = 'UMUM';

    public function authorize(): bool
    {
        // Akses sudah dijaga middleware `admin` di routes/api.php
        return true;
    }

    public function rules(): array
    {
        return [
            // Rombel sekolah (1A-6B) atau "UMUM" untuk peserta gelar karya.
            'rombel' => ['required', 'string', 'regex:/^([1-6][A-Z]|UMUM)$/'],
            'names' => ['required', 'array', 'min:1', 'max:500'],
            'names.*' => ['string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'rombel.required' => 'Rombel wajib dipilih',
            'rombel.regex' => 'Format rombel harus seperti 4A, 4B, atau UMUM',
            'names.required' => 'Daftar nama wajib diisi',
            'names.min' => 'Isi minimal satu nama',
            'names.max' => 'Maksimal 500 nama sekali simpan',
            'names.*.string' => 'Nama harus berupa teks',
            'names.*.max' => 'Nama maksimal 100 karakter',
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

    /**
     * Terima `names` sebagai array maupun teks multi-baris yang ditempel.
     */
    protected function prepareForValidation(): void
    {
        $raw = $this->input('names');

        if ($raw === null) {
            $raw = $this->input('name');
        }

        if (is_string($raw)) {
            $raw = preg_split('/[\r\n,;]+/', $raw) ?: [];
        }

        if (! is_array($raw)) {
            $raw = [];
        }

        $clean = [];

        foreach ($raw as $name) {
            $name = preg_replace('/\s+/u', ' ', trim((string) $name)) ?? '';

            if ($name !== '') {
                $clean[] = $name;
            }
        }

        $this->merge([
            'rombel' => strtoupper(trim((string) $this->input('rombel', ''))),
            'names' => array_values($clean),
        ]);
    }
}
