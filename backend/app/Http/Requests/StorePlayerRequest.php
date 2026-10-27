<?php

namespace App\Http\Requests;

use App\Models\Player;
use Closure;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Pendaftaran pemain — dua mode:
 *
 * - `school`  : nama + rombel (1A..6B). Identitas = nama + rombel.
 * - `general` : cukup nama (gelar karya / acara umum). Identitas = nama saja.
 *
 * Disimpan di tabel yang sama dengan `rombel = null` untuk mode umum, supaya
 * leaderboard, ronde, dan penilaian tetap satu sumber kebenaran.
 */
class StorePlayerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Mode pendaftaran yang diminta klien. */
    private function mode(): string
    {
        return $this->input('mode') === 'general' ? 'general' : 'school';
    }

    public function rules(): array
    {
        $mode = $this->mode();

        return [
            'mode' => ['sometimes', 'string', 'in:school,general'],
            'name' => [
                'required',
                'string',
                'min:3',
                'max:100',
                function (string $attribute, mixed $value, Closure $fail) use ($mode) {
                    if ($this->duplicateExists(trim((string) $value), $mode)) {
                        $fail($mode === 'general'
                            ? 'Nama ini sudah terdaftar. Tambahkan pembeda (contoh: asal sekolah) supaya tidak tertukar.'
                            : 'Nama ini sudah terdaftar di rombel tersebut');
                    }
                },
            ],
            // Rombel hanya wajib di mode sekolah
            'rombel' => $mode === 'school'
                ? ['required', 'string', 'regex:/^[1-6][A-Z]$/', 'max:10']
                : ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi',
            'name.min' => 'Nama minimal 3 karakter',
            'name.max' => 'Nama maksimal 100 karakter',
            'rombel.required' => 'Kelas / rombel wajib dipilih',
            'rombel.regex' => 'Format rombel harus seperti 4A atau 4B',
            'rombel.prohibited' => 'Pendaftaran umum tidak memakai rombel',
            'mode.in' => 'Mode pendaftaran tidak dikenal',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->name)]);
        }

        if ($this->has('rombel') && $this->rombel !== null && $this->rombel !== '') {
            $this->merge(['rombel' => strtoupper(trim((string) $this->rombel))]);
        }
    }

    /**
     * Identitas pemain bergantung mode:
     * - sekolah: nama + rombel (nama sama di rombel lain = orang lain)
     * - umum   : nama saja (tidak ada rombel untuk membedakan)
     */
    private function duplicateExists(string $name, string $mode): bool
    {
        if ($name === '') {
            return false;
        }

        $query = Player::whereRaw('LOWER(name) = ?', [mb_strtolower($name)]);

        if ($mode === 'general') {
            return $query->whereNull('rombel')->exists();
        }

        $rombel = strtoupper(trim((string) $this->input('rombel', '')));

        if ($rombel === '') {
            return false;
        }

        return $query->where('rombel', $rombel)->exists();
    }

    protected function failedValidation(Validator $validator): void
    {
        $errors = $validator->errors();
        $isDuplicate = $errors->has('name') && str_contains((string) $errors->first('name'), 'sudah terdaftar');
        $code = $isDuplicate ? 'DUPLICATE_PLAYER' : 'VALIDATION_ERROR';

        throw new HttpResponseException(response()->json([
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $errors->first(),
                'errors' => $errors->toArray(),
            ],
        ], $isDuplicate ? 409 : 422));
    }
}
