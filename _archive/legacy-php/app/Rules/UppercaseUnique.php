<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

class UppercaseUnique implements Rule
{
    /**
     * Create a new rule instance.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Determine if the validation rule passes.
     *
     * @param  string  $attribute
     * @param  mixed  $value
     * @return bool
     */
    public function passes($attribute, $value)
    {
        // Ensure the value is exactly 3 uppercase letters
        if (!preg_match('/^[A-Z]{3}$/', $value)) {
            return false;
        }

        // Ensure there are no repeating characters
        if (count(array_unique(str_split($value))) < 3) {
            return false;
        }

        return true;
    }


    /**
     * Get the validation error message.
     *
     * @return string
     */
    public function message()
    {
        return 'The :attribute must be 3 unique uppercase letters.';
    }
}
