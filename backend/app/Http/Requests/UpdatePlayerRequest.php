<?php

namespace App\Http\Requests;

use App\Models\Player;
use Closure;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdatePlayerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'min:3',
                'max:100',
                function (string $attribute, mixed $value, Closure $fail) {
                    if ($this->duplicateExists(trim((string) $value), (string) $this->input('rombel', ''))) {
                        $fail('Nama ini sudah terdaftar di rombel tersebut');
                    }
                },
            ],
            'rombel' => ['sometimes', 'required', 'string', 'regex:/^[1-6][A-Z]$/', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.min' => 'Nama minimal 3 karakter',
            'name.max' => 'Nama maksimal 100 karakter',
            'rombel.regex' => 'Format rombel harus seperti 4A atau 4B',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->name)]);
        }

        if ($this->has('rombel')) {
            $this->merge(['rombel' => strtoupper(trim((string) $this->rombel))]);
        }
    }

    /**
     * Cek nama+rombel bentrok dengan pemain LAIN (abaikan pemain yang sedang diedit).
     */
    private function duplicateExists(string $name, string $rombel): bool
    {
        $playerId = $this->route('id');

        if ($name === '') {
            return false;
        }

        $query = Player::whereRaw('LOWER(name) = ?', [mb_strtolower($name)]);

        if ($rombel !== '') {
            $query->where('rombel', strtoupper(trim($rombel)));
        }

        if ($playerId) {
            $query->where('id', '!=', $playerId);
        }

        return $query->exists();
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
